const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
require('dotenv').config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const imagesDir = path.join(__dirname, 'images');

async function uploadImages() {
    let uploadSuccessCount = 0;
    let uploadFailCount = 0;
    let withGpsCount = 0;
    let withoutGpsCount = 0;

    try {
        const files = fs.readdirSync(imagesDir);
        const jpgFiles = files.filter(file => file.toLowerCase().endsWith('.jpg'));

        if (jpgFiles.length === 0) {
            console.log('images 폴더에 JPG 파일이 없습니다.');
            return;
        }

        console.log('Cloudinary에 이미지 업로드를 시작합니다...');

        for (let i = 0; i < jpgFiles.length; i++) {
            const file = jpgFiles[i];
            const filePath = path.join(imagesDir, file);
            try {
                const uploadResult = await cloudinary.uploader.upload(filePath, {
                    folder: 'photo-map',
                    media_metadata: true,
                    exif: true
                });
                
                console.log(`[${i + 1}/${jpgFiles.length}] ${file} 업로드 완료: ${uploadResult.secure_url}`);
                
                if (uploadResult.exif.GPSLatitude && uploadResult.exif.GPSLongitude) {
                    console.log('GPS 좌표:', {
                        latitude: uploadResult.exif.GPSLatitude,
                        longitude: uploadResult.exif.GPSLongitude
                    });
                    withGpsCount++;
                } else {
                    console.log('GPS 정보 없음');
                    withoutGpsCount++;
                }
                
                uploadSuccessCount++;
            } catch (uploadError) {
                console.error(`[${i + 1}/${jpgFiles.length}] ${file} 업로드 실패:`, uploadError);
                uploadFailCount++;
            }
        }

        console.log('\n업로드 통계:');
        console.log(`성공: ${uploadSuccessCount}개, 실패: ${uploadFailCount}개`);
        console.log(`GPS 정보 있음: ${withGpsCount}개, GPS 정보 없음: ${withoutGpsCount}개`);

    } catch (error) {
        console.error('오류 발생:', error);
    }
}

uploadImages();

async function deleteAllImagesInPhotoMap() {
    try {
        let hasMore = true;
        let nextCursor = null;
        let totalDeleted = 0;

        while (hasMore) {
            // 100개씩 리소스 조회
            const result = await cloudinary.api.resources({
                type: 'upload',
                prefix: 'photo-map',
                max_results: 100,
                next_cursor: nextCursor
            });

            if (result.resources.length === 0) {
                break;
            }

            // 100개씩 삭제
            const publicIds = result.resources.map(resource => resource.public_id);
            await cloudinary.api.delete_resources(publicIds);
            
            totalDeleted += publicIds.length;
            console.log(`${totalDeleted}개의 이미지 삭제 완료`);

            // 다음 페이지 확인
            hasMore = result.next_cursor != null;
            nextCursor = result.next_cursor;
        }

        console.log(`총 ${totalDeleted}개의 이미지가 삭제되었습니다.`);
    } catch (error) {
        console.error('이미지 삭제 중 오류 발생:', error);
        throw error;
    }
}

// deleteAllImagesInPhotoMap()
//     .then(() => console.log('삭제 완료'))
//     .catch(err => console.error('삭제 실패:', err));