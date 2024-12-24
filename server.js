const express = require('express');

// 사진 저장 클라우드 (Cloudinary) 관련 라이브러리 로드
require('dotenv').config();
const cloudinary = require('cloudinary').v2;

// Cloudinary 설정
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();

// ▼ 정적 파일 제공: index.html, styles.css 및 images 폴더를 서빙
app.use(express.static(__dirname));

// [성능개선 추가] 서버 시작 시 images 디렉토리를 스캔해 모든 JPG 파일의 EXIF를 미리 파싱하고 캐시
let imageDataCache = []; // { path: 'images/xxx.jpg', lat: number, lng: number, date: 'YYYY-MM-DD', time: 'HH:MM' } 형태의 배열

// [성능개선 추가] EXIF 파싱 함수
function parseExifForAllImages() {
  return new Promise(async (resolve, reject) => {
    try {
      let allResults = [];
      let hasMore = true;
      let nextCursor = null;

      while (hasMore) {
        const result = await cloudinary.search
          .expression('folder:photo-map')
          .with_field('image_metadata')
          .max_results(100)
          .next_cursor(nextCursor)
          .execute();

        const resources = result.resources;
        
        resources.forEach(resource => {
          if (resource.image_metadata) {
            // GPS 좌표 변환 함수
            function convertGPSToDecimal(gpsData) {
              if (!gpsData) return null;
              
              // "31 deg 48' 16.09" N" 형식 파싱
              const regex = /(\d+)\s*deg\s*(\d+)'\s*([\d.]+)"\s*([NSEW])/;
              const match = gpsData.match(regex);
              
              if (!match) return null;
              
              const degrees = parseFloat(match[1]);
              const minutes = parseFloat(match[2]);
              const seconds = parseFloat(match[3]);
              const direction = match[4];
              
              let decimal = degrees + (minutes / 60) + (seconds / 3600);
              
              // 남위, 서경인 경우 음수로 변환
              if (direction === 'S' || direction === 'W') {
                  decimal *= -1;
              }
              
              return decimal;
          }

            const lat = convertGPSToDecimal(resource.image_metadata.GPSLatitude);
            const lng = convertGPSToDecimal(resource.image_metadata.GPSLongitude);
            
            let formattedDate = null;
            let formattedTime = null;
            if (resource.image_metadata.DateTimeOriginal) {
              const dateStr = resource.image_metadata.DateTimeOriginal;
              // YYYY:MM:DD HH:MM:SS 형식을 YYYY-MM-DD HH:MM:SS 형식으로 변환
              const normalizedDateStr = dateStr.replace(/(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
              const date = new Date(normalizedDateStr);
              const utcDate = new Date(date.getTime());
              const year = utcDate.getFullYear();
              const month = String(utcDate.getMonth() + 1).padStart(2, '0');
              const day = String(utcDate.getDate()).padStart(2, '0');
              formattedDate = `${year}-${month}-${day}`;
          
              const hour = String(utcDate.getHours()).padStart(2, '0');
              const minute = String(utcDate.getMinutes()).padStart(2, '0');
              formattedTime = `${hour}:${minute}`;
          }

            const thumbnailUrl = cloudinary.url(resource.public_id, {
              width: 300,
              height: 300,
              crop: 'thumb'
            });

            allResults.push({
              thumbnailPath: thumbnailUrl,
              originalPath: resource.secure_url,
              lat: lat,
              lng: lng,
              date: formattedDate,
              time: formattedTime
            });
          }
        });

        // 다음 페이지 확인
        hasMore = result.next_cursor != null;
        nextCursor = result.next_cursor;
        
        console.log(`${allResults.length}개의 이미지 로드됨...`);
      }
      
      allResults.reverse();
      resolve(allResults);
    } catch (err) {
      reject(err);
    }
  });
}

// [성능개선 추가] /api/image_data 라우트: 미리 파싱한 EXIF 위치 정보 및 날짜 정보 반환
app.get('/api/image_data', (req, res) => {
  res.json(imageDataCache);
});

const port = 3000;

// 서버 시작 시 EXIF 파싱 및 캐싱
parseExifForAllImages().then(results => {
  imageDataCache = results;
  console.log(`총 ${imageDataCache.length}개 이미지의 EXIF 정보 파싱 완료.`);
  app.listen(port, () => {
    console.log(`서버가 http://localhost:${port} 에서 실행중입니다.`);
  });
}).catch(err => {
  console.error("EXIF 파싱 중 오류 발생:", err);
});