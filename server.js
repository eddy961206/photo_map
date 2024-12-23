// ====================
// [변경 및 추가 내용 - Node.js 서버 코드 예시]
// - 이 코드는 images 폴더의 JPG 파일 목록을 읽어 JSON으로 반환하는 API를 구현합니다.
// - 모든 console.log와 주석은 한국어로 작성하였습니다.
// ====================

const express = require('express');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

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
    fs.readdir(imagesDir, (err, files) => {
      if (err) return reject(err);
      const jpgFiles = files.filter(file => file.toLowerCase().endsWith('.jpg'));

      let results = [];
      for (let file of jpgFiles) {
        const filePath = path.join(imagesDir, file);
        const thumbnailPath = `images/thumbnails/${file}`;
        const originalPath = `images/${file}`;
        const buffer = fs.readFileSync(filePath);
        const parser = ExifParser.create(buffer);
        const result = parser.parse();

        // EXIF GPS 정보 확인
        const lat = result.tags.GPSLatitude;
        const lng = result.tags.GPSLongitude;

        // EXIF 촬영 날짜 정보 확인 (DateTimeOriginal)
        const dateOriginal = result.tags.DateTimeOriginal;

        let formattedDate = null;
        let formattedTime = null;
        if (dateOriginal) {
          // exif-parser는 DateTimeOriginal을 초 단위의 Unix 타임스탬프로 반환
          // 밀리초 단위로 변환하고 UTC 기준이므로 필요시 타임존 변환
          const date = new Date((dateOriginal * 1000) - (9 * 60 * 60 * 1000));  // UTC -> 한국/일본 시각으로

          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          formattedDate = `${year}-${month}-${day}`;

          const hour = date.getHours();
          const minute = date.getMinutes();
          formattedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        }

        if (lat && lng && formattedDate && formattedTime) {
          results.push({
            thumbnailPath, // 썸네일 경로
            originalPath,  // 원본 경로
            lat: lat,
            lng: lng,
            date: formattedDate,
            time: formattedTime
          });
        } else {
          if (!lat || !lng) {
            // console.log(`${file} 파일에 GPS 좌표 정보가 없습니다.`);
          }
          if (!formattedDate || !formattedTime) {
            // console.log(`${file} 파일에 시간 정보가 없습니다.`);
          }
        }
      }
      resolve(results);
    });
  });
}

// [썸네일 생성 함수 추가]
function generateThumbnails() {
  const thumbnailDir = path.join(imagesDir, 'thumbnails');
  if (!fs.existsSync(thumbnailDir)) {
    fs.mkdirSync(thumbnailDir);
  }

  fs.readdir(imagesDir, (err, files) => {
    if (err) return console.error("이미지 디렉토리 읽기 실패:", err);
    files.filter(file => file.toLowerCase().endsWith('.jpg')).forEach(file => {
      const inputPath = path.join(imagesDir, file);
      const outputPath = path.join(thumbnailDir, file);

      // 썸네일이 이미 존재하면 건너뛰기
      if (fs.existsSync(outputPath)) return;

      // 썸네일 생성
      sharp(inputPath)
        .resize({ width: 100 }) // 썸네일 너비 100px
        .rotate()
        .toFile(outputPath, (err, info) => {
          if (err) console.error(`썸네일 생성 실패 (${file}):`, err);
        });
    });
  });
}

// /api/images 라우트: images 폴더 내 JPG 파일 리스트 반환
app.get('/api/images', (req, res) => {
  fs.readdir(imagesDir, (err, files) => {
    if (err) {
      console.log("이미지 디렉토리 읽기 오류:", err);
      return res.status(500).json({ error: 'Failed to read image directory' });
    }
    const jpgFiles = files.filter(file => file.toLowerCase().endsWith('.jpg'));
    const imageList = jpgFiles.map(file => `images/${file}`);
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