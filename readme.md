# 사진 위치 정보 지도 표시 프로젝트

이 프로젝트는 `images` 폴더 내의 JPG 이미지 파일들에서 EXIF GPS치 정보를 추출하여, 해당 위치를 지도 상에 마커로 표시하는 웹 애플리케이션입니다. 사용자는 지도 위의 마커를 클릭하여 해당 위치에서 촬영된 사진들을 갤러리 형태로 볼 수 있습니다.
## 기술 스택
-   **Node.js**: 서버 사이드 런타임 환경
   **Express**: 웹 애플리케이션 프레임워크
   **Leaflet**: 인터랙티브 맵 라이브러리
   **Leaflet.markercluster**: Leaflet 플러그인으로, 마커 클러스터링 기능 제공
   **exif-parser**: 이미지 파일의 EXIF 메타데이터를 읽기 위한 라이브러리
## 설치 및 실행 방법
1.  **Node.js 설치**: Node.js가 설치되어 있지 않다면, [Node.js 공식 웹사이트](https://nodejs.org/)에서 다운로드하여 설치합니다.
.  **프로젝트 복제**: 프로젝트 저장소를 로컬 컴퓨터에 복제합니다.
   ```bash
   git clone https://github.com/eddy961206/photo_map
   ```
.  **의존성 설치**: 프로젝트 루트 디렉토리에서 다음 명령을 실행하여 필요한 패키지를 설치합니다.
   ```bash
   npm install
   ```
.  **서버 실행**: 다음 명령으로 서버를 시작합니다.
   ```bash
   node server.js
   ```
.  **애플리케이션 접속**: 웹 브라우저에서 `http://localhost:3000`에 접속하여 애플리케이션을 확인합니다.
## 주요 기능
-   `images` 폴더 내 JPG 이미지 파일에서 EXIF GPS 정보 추출
   추출된 위치 정보를 기반으로 지도에 마커 표시
   마커 클러스터링을 통해 다수의 마커를 효율적으로 관리
   마커 클릭 시 해당 위치의 이미지들을 갤러리 형태로 팝업에 표시
## API 엔드포인트
### `/api/images`
`images` 폴더 내의 모든 JPG 파일 목록을 JSON 형식으로 반환합니다.
-   **요청**: `GET /api/images`
   **응답 예시**:
   ```json
   ["images/image1.jpg", "images/image2.jpg", ...]
   ```
### `/api/image_data`
`images` 폴더 내의 모든 JPG 파일의 EXIF GPS 정보와 파일 경로를 JSON 형식으로 반환합니다.
-   **요청**: `GET /api/image_data`
   **응답 예시**:
   ```json
   [
       { "path": "images/image1.jpg", "lat": 37.12345, "lng": 127.12345 },
       { "path": "images/image2.jpg", "lat": 37.67890, "lng": 126.67890 },
       ...
   ]
   ```
## 파일 구조
-   `/`: 프로젝트 루트
   -   `index.html`: 메인 HTML 파일
   -   `server.js`: Node.js 서버 스크립트
   -   `package.json`: 프로젝트 의존성 및 설정 파일
   -   `/images`: 이미지 파일들이 위치하는 폴더
## 추가 정보
-   이미지 파일에 GPS EXIF 정보가 없는 경우, 해당 이미지는 지도에 표시되지 않습니다.
   `convertToDecimal` 함수는 위도와 경도를 십진수 형식으로 변환합니다.
   서버는 `http://localhost:3000`에서 실행됩니다.