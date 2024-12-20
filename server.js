// ====================
// [변경 및 추가 내용 - Node.js 서버 코드 예시]
// - 이 코드는 images 폴더의 JPG 파일 목록을 읽어 JSON으로 반환하는 API를 구현합니다.
// - 모든 console.log와 주석은 한국어로 작성하였습니다.
// ====================

const express = require('express');
const fs = require('fs');
const path = require('path');

// [성능개선 추가] EXIF 파싱용 라이브러리 로드 (exiftool 호출 또는 exif-parser 사용 가능)
// 여기서는 exif-parser를 예로 듬 (npm install exif-parser)
const ExifParser = require('exif-parser');

const app = express();

// ▼ 정적 파일 제공: index.html 및 images 폴더를 서빙
app.use(express.static(__dirname));

const imagesDir = path.join(__dirname, 'images');

// [성능개선 추가] 서버 시작 시 images 디렉토리를 스캔해 모든 JPG 파일의 EXIF를 미리 파싱하고 캐시
let imageDataCache = []; // { path: 'images/xxx.jpg', lat: number, lng: number } 형태의 배열

function convertToDecimal(coord, ref) {
  if (!coord) return null;
  const degrees = coord[0];
  const minutes = coord[1];
  const seconds = coord[2];
  let decimal = degrees + (minutes/60) + (seconds/3600);
  if (ref === 'S' || ref === 'W') {
    decimal = decimal * -1;
  }
  return decimal;
}

// [성능개선 추가] EXIF 파싱 함수
function parseExifForAllImages() {
  return new Promise((resolve, reject) => {
    fs.readdir(imagesDir, (err, files) => {
      if (err) return reject(err);
      const jpgFiles = files.filter(file => file.toLowerCase().endsWith('.jpg'));

      let results = [];
      for (let file of jpgFiles) {
        const filePath = path.join(imagesDir, file);
        const buffer = fs.readFileSync(filePath);
        const parser = ExifParser.create(buffer);
        const result = parser.parse();

        // EXIF GPS 정보 확인
        // exif-parser로 얻는 GPS 정보는 deg/min/sec 형태가 아닌 decimal 형식일 수도 있으니 상황에 맞게 파싱해야 함
        // exif-parser 결과에서 GPS 정보는 result.tags.GPSLatitude, result.tags.GPSLongitude 형태로 decimal 값이 들어갈 수 있음.
        // 여기서는 EXIF GPS 정보가 존재한다고 가정하고 처리. 실제 사용 시 존재 여부 체크 필요.
        const lat = result.tags.GPSLatitude;
        const lng = result.tags.GPSLongitude;

        if (lat && lng) {
          // [성능개선 추가] 썸네일 경로 사용 (썸네일 미리 생성했다고 가정, 없으면 원본 사용)
          // 실제 썸네일 생성은 별도 과정 필요 (예: Sharp 또는 ImageMagick)
          const thumbnailPath = `images/${file}`; // 여기서는 일단 원본 경로 사용
          results.push({ path: thumbnailPath, lat: lat, lng: lng });
        }
      }
      resolve(results);
    });
  });
}

// /api/images 라우트: images 폴더 내 JPG 파일 리스트 반환 (기존)
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

// [성능개선 추가] /api/image_data 라우트: 미리 파싱한 EXIF 위치 정보 반환
app.get('/api/image_data', (req, res) => {
  res.json(imageDataCache);
});

const port = 3000;
parseExifForAllImages().then(results => {
  imageDataCache = results;
  console.log(`총 ${imageDataCache.length}개 이미지의 EXIF 정보 파싱 완료.`);
  app.listen(port, () => {
    console.log(`서버가 http://localhost:${port} 에서 실행중입니다.`);
  });
}).catch(err => {
  console.error("EXIF 파싱 중 오류 발생:", err);
});
