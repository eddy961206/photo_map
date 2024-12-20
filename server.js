// ====================
// [변경 및 추가 내용 - Node.js 서버 코드 예시]
// - 이 코드는 images 폴더의 JPG 파일 목록을 읽어 JSON으로 반환하는 API를 구현합니다.
// - 모든 console.log와 주석은 한국어로 작성하였습니다.
// ====================

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

// ▼ 정적 파일 제공: index.html 및 images 폴더를 서빙
app.use(express.static(__dirname));

// ▼ /api/images 라우트: images 폴더 내의 jpg 파일 목록을 JSON으로 반환
app.get('/api/images', (req, res) => {
  const imagesDir = path.join(__dirname, 'images');
  fs.readdir(imagesDir, (err, files) => {
    if (err) {
      console.log("이미지 디렉토리 읽기 오류:", err);
      return res.status(500).json({ error: 'Failed to read image directory' });
    }

    // ▼ jpg 파일만 필터링
    const jpgFiles = files.filter(file => file.toLowerCase().endsWith('.jpg'));

    // ▼ jpg 파일 리스트를 JSON으로 반환 (상대경로 포함)
    // 클라이언트는 '/images/파일명' 형식으로 접근 가능.
    const imageList = jpgFiles.map(file => `images/${file}`);
    res.json(imageList);
  });
});

const port = 3000;
app.listen(port, () => {
  console.log(`서버가 http://localhost:${port} 에서 실행중입니다.`);
});
