const express = require('express');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// 사진 저장 클라우드 (Cloudinary) 관련 라이브러리 로드
require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// Cloudinary 설정
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// [성능개선 추가] EXIF 파싱용 라이브러리 로드 (exif-parser 호출)
const ExifParser = require('exif-parser');

const app = express();

// ▼ 정적 파일 제공: index.html, styles.css 및 images 폴더를 서빙
app.use(express.static(__dirname));

const imagesDir = path.join(__dirname, 'images');

// [성능개선 추가] 서버 시작 시 images 디렉토리를 스캔해 모든 JPG 파일의 EXIF를 미리 파싱하고 캐시
let imageDataCache = []; // { path: 'images/xxx.jpg', lat: number, lng: number, date: 'YYYY-MM-DD', time: 'HH:MM' } 형태의 배열

// [성능개선 추가] EXIF 파싱 함수
function parseExifForAllImages() {
  return new Promise((resolve, reject) => {
    cloudinary.api.resources({ type: 'upload', prefix: 'photo-map' })
      .then(result => {
        const resources = result.resources;
        let results = [];
        
        resources.forEach(resource => {
          if (resource.exif) {
            // GPS 좌표 변환 함수
            function convertGPSToDecimal(gpsData) {
              if (!gpsData) return null;
              const parts = gpsData.split(', ');
              if (parts.length !== 3) return null;

              const degrees = parseFloat(parts[0].split('/')[0]);
              const minutes = parseFloat(parts[1].split('/')[0]);
              const seconds = parseFloat(parts[2].split('/')[1]) / parseFloat(parts[2].split('/')[0]);

              return degrees + (minutes / 60) + (seconds / 3600);
            }

            const lat = convertGPSToDecimal(resource.exif.GPSLatitude);
            const lng = convertGPSToDecimal(resource.exif.GPSLongitude);
            
            // 날짜 정보 파싱
            let formattedDate = null;
            let formattedTime = null;
            if (resource.exif.DateTimeOriginal) {
              const dateStr = resource.exif.DateTimeOriginal;
              const date = new Date(dateStr);
              
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              formattedDate = `${year}-${month}-${day}`;

              const hour = date.getHours();
              const minute = date.getMinutes();
              formattedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
            }

            const thumbnailUrl = cloudinary.url(resource.public_id, {
              folder: 'photo-map',
              width: 300,
              height: 300,
              crop: 'thumb'
            });

            results.push({
              thumbnailPath: thumbnailUrl,
              originalPath: resource.secure_url,
              lat: lat,
              lng: lng,
              date: formattedDate,
              time: formattedTime
            });
          }
        });
        
        resolve(results);
      })
      .catch(err => {
        reject(err);
      });
  });
}

// [썸네일 생성 함수 추가]
function generateThumbnails() {
  // Cloudinary에서 썸네일 생성하므로 로컬 썸네일 생성 불필요
  console.log("Cloudinary에서 썸네일 생성하므로 로컬 썸네일 생성 불필요");
}

// /api/images 라우트: images 폴더 내 JPG 파일 리스트 반환
app.get('/api/images', (req, res) => {
  fs.readdir(imagesDir, (err, files) => {
    if (err) {
      console.log("이미지 디렉토리 읽기 오류:", err);
      return res.status(500).json({ error: 'Failed to read image directory' });
    }
    const jpgFiles = files.filter(file => file.toLowerCase().endsWith('.jpg'));
    // Cloudinary URL 반환하도록 수정
    const imageList = jpgFiles.map(file => {
      return cloudinary.url(file, {
        folder: 'photo-map'
      });
    });
    res.json(imageList);
  });
});

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

// 서버 시작 시 썸네일 생성
generateThumbnails();