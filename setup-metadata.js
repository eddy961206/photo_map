const cloudinary = require('cloudinary').v2;
require('dotenv').config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

async function setupMetadataFields() {
    try {
        // 위도 필드 생성
        await cloudinary.api.add_metadata_field({
            external_id: "latitude",
            label: "Latitude",
            type: "string"
        });
        console.log("위도 필드 생성 완료");

        // 경도 필드 생성
        await cloudinary.api.add_metadata_field({
            external_id: "longitude",
            label: "Longitude",
            type: "string"
        });
        console.log("경도 필드 생성 완료");

    } catch (error) {
        if (error.error && error.error.message.includes('already exists')) {
            console.log("메타데이터 필드가 이미 존재합니다.");
        } else {
            console.error("메타데이터 필드 생성 중 오류:", error);
        }
    }
}

setupMetadataFields();
