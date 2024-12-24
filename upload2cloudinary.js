const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Cloudinary 설정
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const imagesDir = path.join(__dirname, 'images');

async function uploadImages() {
    let uploadSuccessCount = 0;
    let uploadFailCount = 0;
    let skipCount = 0;

    try {
        const files = fs.readdirSync(imagesDir);
        const jpgFiles = files.filter(file => file.toLowerCase().endsWith('.jpg'));

        if (jpgFiles.length === 0) {
            console.log('images 폴더에 JPG 파일이 없습니다.');
            return;
        }

        console.log('Cloudinary에 이미지 업로드를 시작합니다...');

        for (const file of jpgFiles) {
            const filePath = path.join(imagesDir, file);
            // Cloudinary에 없는 경우 업로드
            try {
                const uploadResult = await cloudinary.uploader.upload(filePath, {
                    folder: 'photo-map',
                    upload_preset: 'photo_map_mine'
                });
                console.log(`${file} 업로드 완료: ${uploadResult.secure_url}`);
                uploadSuccessCount++;
            } catch (uploadError) {
                console.error(`${file} 업로드 실패:`, uploadError);
                uploadFailCount++;
            }
        }

        console.log('모든 이미지 업로드 완료.');
        console.log(`업로드 성공: ${uploadSuccessCount}개, 업로드 실패: ${uploadFailCount}개, 스킵: ${skipCount}개`);

        // Cloudinary 사용량 정보 가져오기
        const usage = await cloudinary.api.usage();
        console.log('Cloudinary 사용량 정보:');
        console.log(`  저장 공간 사용량: ${usage.storage.used} MB / ${usage.storage.limit} MB`);
        console.log(`  API 사용량: ${usage.requests.used} / ${usage.requests.limit}`);
        console.log(`  변환 사용량: ${usage.transformations.used} / ${usage.transformations.limit}`);
    } catch (readDirError) {
        console.error('images 폴더를 읽는 중 오류 발생:', readDirError);
    }
}

uploadImages();