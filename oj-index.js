const PhotoMapApp = {
    // ▼ 지도, 마커, 전역 변수들을 객체 프로퍼티로 선언
    map: null,           // 지도 객체
    markers: null,       // 마커 클러스터 그룹
    imageData: [],       // 서버에서 받은 전체 이미지 정보
    locationMap: {},     // 좌표별로 이미지 묶음 { "lat_lng_key": { lat, lng, date, timeArray, ... } }
    allDates: new Set(), // 전체 날짜 Set
    currentSelectedDate: null,
    isTimeSliderEnabled: false,
    // 위치 정보 없는 사진 관련
    noGpsImages: [],
    currentNoGpsGalleryPage: 1,
    lastNoGpsGalleryPage: 1,
    imagesPerPage: 20,
    totalNoGpsGalleryPages: 1,

    // 초기화 함수
    init: function() {
        "use strict";
        // 지도 생성
        this.createMap();
        // 마커 클러스터 그룹 생성
        this.createMarkerCluster();
        // 이벤트 바인딩
        this.bindEvents();
        // 서버에서 EXIF 미리 파싱된 이미지 정보를 불러오는 AJAX 호출
        this.loadImageData();
    },

    // 지도 생성
    createMap: function() {
        this.map = L.map('map').setView([35.0, 135.0], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
    },

    // 마커 클러스터 그룹 생성
    createMarkerCluster: function() {
        // ▼ iconCreateFunction: 클러스터 아이콘을 대표 사진으로 생성
        this.markers = L.markerClusterGroup({
            iconCreateFunction: function(cluster) {
                const childMarkers = cluster.getAllChildMarkers();
                // 첫 번째 마커의 iconUrl 얻기
                const firstMarkerIcon = childMarkers[0].options.icon.options.iconUrl;
                // 클러스터에 몇 장이 포함되었는지 숫자
                const childCount = cluster.getChildCount();

                // DivIcon 반환(대표 사진을 배경으로)
                return L.divIcon({
                    html: `<div class="cluster-icon" style="background-image: url('${firstMarkerIcon}');">
                             <span>${childCount}</span>
                           </div>`,
                    className: 'my-cluster-icon',
                    iconSize: [50, 50]
                });
            }
        });
        this.map.addLayer(this.markers);
    },

    // 이벤트 바인딩 (슬라이더 토글, 날짜 클릭, 등등)
    bindEvents: function() {
        const self = this;

        // 시간 슬라이더 토글 이벤트 리스너
        $('#timeSliderToggle').on('change', function() {
            self.isTimeSliderEnabled = $(this).prop('checked');
            $('#timeSlider').prop('disabled', !self.isTimeSliderEnabled);

            if (self.currentSelectedDate) {
                if (self.isTimeSliderEnabled) {
                    const selectedMinutes = parseInt($('#timeSlider').val(), 10);
                    self.displayImagesByDateAndTime(self.currentSelectedDate, selectedMinutes);
                } else {
                    self.displayImagesByDate(self.currentSelectedDate);
                }
            }
        });

        // 위치 정보 없는 사진 갤러리 모달 외부 클릭 시 닫기
        $(window).on('click', function(event) {
            if ($(event.target).is('#noGpsGalleryModal')) {
                $('#noGpsGalleryModal').fadeOut();
            }
        });

        // 인디케이터 클릭 시 해당 슬라이드로 이동
        $(document).on('click', '.indicator', function() {
            const index = $(this).index();
            const slider = $(this).closest('.photo-gallery-container, .image-slider');
            const images = $(slider).find('.slide-image');

            images.removeClass('active');
            $(images[index]).addClass('active');

            // 인디케이터 업데이트
            $(this).siblings('.indicator').removeClass('active');
            $(this).addClass('active');
        });

        // 위치 정보 없는 사진 갤러리 모달 닫기 버튼
        $('.close-button').on('click', function() {
            $('#noGpsGalleryModal').fadeOut();
            self.lastNoGpsGalleryPage = self.currentNoGpsGalleryPage;
        });
    },

    // 서버에서 EXIF 미리 파싱된 이미지 정보 로드
    loadImageData: function() {
        const self = this;

        $.ajax({
            url: '/api/image_data',
            method: 'GET',
            dataType: 'json',
            success: function(data) {
                self.imageData = data;
                let noGpsCount = 0;

                data.forEach(item => {
                    // 위치 정보 여부에 따라 분류
                    if (!item.lat || !item.lng) {
                        self.noGpsImages.push(item);
                        noGpsCount++;
                    } else {
                        self.allDates.add(item.date);
                    }
                });

                // 위치 정보 없는 사진 버튼 텍스트 업데이트
                $('#noGpsGalleryButton').text(`위치정보 없는 사진 (${noGpsCount})`);

                // 날짜 버튼 생성
                const sortedDates = Array.from(self.allDates).sort();
                self.createDateButtons(sortedDates);

                // 초기 날짜 버튼 활성화 (디폴트: 첫 번째 날짜)
                if (sortedDates.length > 0) {
                    self.currentSelectedDate = sortedDates[0];
                    self.buildLocationMap(self.currentSelectedDate);
                    self.initializeTimeSliderForDate(self.currentSelectedDate);
                    self.displayImagesByDate(self.currentSelectedDate);
                    $('.date-button').first().addClass('active');
                }

                // GPS 없는 사진 갤러리 모달 열기 버튼
                $('#noGpsGalleryButton').on('click', function() {
                    self.openNoGpsGalleryModal();
                });
            },
            error: function(err) {
                console.log("에러 발생:", err);
            }
        });
    },

    // 날짜 버튼 생성 함수
    createDateButtons: function(dates) {
        const self = this;
        const container = $('#dateButtonsContainer');
        container.empty(); // 혹시 모르니 초기화

        dates.forEach(dateStr => {
            // 해당 날짜에 속하는 이미지 개수 계산
            const imageCount = self.imageData.filter(item => item.date === dateStr).length;
            const formattedDate = self.formatDateButton(dateStr);

            const button = $('<button></button>')
                .text(formattedDate + ` (${imageCount})`)
                .addClass('date-button')
                .on('click', function() {
                    $('.date-button').removeClass('active');
                    $(this).addClass('active');
                    self.currentSelectedDate = dateStr;
                    self.buildLocationMap(dateStr);
                    self.initializeTimeSliderForDate(dateStr);

                    if (self.isTimeSliderEnabled) {
                        const selectedMinutes = parseInt($('#timeSlider').val(), 10);
                        self.displayImagesByDateAndTime(dateStr, selectedMinutes);
                    } else {
                        self.displayImagesByDate(dateStr);
                    }
                });

            container.append(button);
        });
    },

    // 날짜 버튼 텍스트 포맷 (예: 08/02(월))
    formatDateButton: function(dateStr) {
        const date = new Date(dateStr);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dayOfWeek = this.getKoreanDayOfWeek(date.getDay());
        return `${month}/${day}(${dayOfWeek})`;
    },

    getKoreanDayOfWeek: function(day) {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return days[day];
    },

    // [핵심 변경] 특정 날짜에 대한 locationMap을 만들어서
    // 같은 좌표의 사진을 묶고, 그 중 "가장 빠른 시간(minMinute)"을 별도로 계산
    buildLocationMap: function(selectedDate) {
        this.locationMap = {};
        const filtered = this.imageData.filter(
            item => item.date === selectedDate && item.lat && item.lng
        );

        filtered.forEach(item => {
            // 소수점 5자리로 좌표를 묶음(정확도 조절 가능)
            const key = item.lat.toFixed(5) + "," + item.lng.toFixed(5);

            if (!this.locationMap[key]) {
                this.locationMap[key] = {
                    lat: item.lat,
                    lng: item.lng,
                    date: item.date,
                    timeArray: [],
                    thumbnailPaths: [],
                    originalPaths: [],
                    minMinute: 1440 // 초기값 큰 수
                };
            }
            this.locationMap[key].timeArray.push(item.time);
            this.locationMap[key].thumbnailPaths.push(item.thumbnailPath);
            this.locationMap[key].originalPaths.push(item.originalPath);

            // 가장 빠른 시간(분) 계산
            const [hh, mm] = item.time.split(':').map(Number);
            const itemMinutes = hh * 60 + mm;
            if (itemMinutes < this.locationMap[key].minMinute) {
                this.locationMap[key].minMinute = itemMinutes;
            }
        });
    },

    // 선택된 날짜에 대해 시간 슬라이더 설정
    initializeTimeSliderForDate: function(selectedDate) {
        const self = this;
        // locationMap에 있는 각 좌표 그룹의 minMinute들을 추출
        let minMinutesArray = Object.keys(this.locationMap)
            .map(key => this.locationMap[key].minMinute)
            .sort((a, b) => a - b);

        if (minMinutesArray.length === 0) {
            $('#timeSlider').attr('disabled', true);
            $('#timeLabel').text('N/A');
            return;
        }

        // 중복 제거
        minMinutesArray = [...new Set(minMinutesArray)];

        // datalist 업데이트 (균등 간격)
        const timeTicksElement = $('#timeTicks');
        timeTicksElement.empty();
        const interval = 100 / (minMinutesArray.length - 1); // 균등 간격 계산 (0 ~ 100 기준)
        for (let i = 0; i < minMinutesArray.length; i++) {
            const tickValue = i * interval;
            timeTicksElement.append(`<option value="${tickValue}" data-index="${i}">`);
        }
        $('#timeSlider').attr('disabled', !this.isTimeSliderEnabled);
        $('#timeSlider').attr('min', 0);
        $('#timeSlider').attr('max', 100);
        $('#timeSlider').val(0);
        this.updateTimeLabel(minMinutesArray[0]);

        // 슬라이더 이벤트 핸들러
        $('#timeSlider').off('input').on('input', function() {
            const currentValue = parseFloat($(this).val());
            // 균등 간격의 틱 중 가장 가까운 인덱스 찾기
            const closestIndex = Math.round(currentValue / interval);
            const closestTickValue = closestIndex * interval;
            $(this).val(closestTickValue);
            // 해당 인덱스의 실제 시간(분) 가져오기
            const selectedMinutes = minMinutesArray[closestIndex];
            self.updateTimeLabel(selectedMinutes);

            if (self.isTimeSliderEnabled) {
                self.displayImagesByDateAndTime(selectedDate, selectedMinutes);
            }
        });
    },

    updateTimeLabel: function(minutes) {
        const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
        const mm = String(minutes % 60).padStart(2, '0');
        $('#timeLabel').text(`${hh}:${mm}`);
    },

    // [수정] 날짜만 활성화된 경우(시간 필터 X), 해당 날짜 locationMap 기반 마커 표시
    displayImagesByDate: function(selectedDate) {
        this.markers.clearLayers();

        // locationMap에 있는 모든 좌표를 순회하며 마커 생성
        for (const key in this.locationMap) {
            const loc = this.locationMap[key];
            const marker = this.createMarker(loc);
            this.markers.addLayer(marker);
        }

        // 지도 범위 맞춤
        if (this.markers.getLayers().length > 0) {
            this.map.fitBounds(this.markers.getBounds());
        } else {
            console.log("선택한 날짜에 표시할 위치가 없습니다.");
        }
    },

    // [수정] 날짜 + 시간 슬라이더 활성화 시, locationMap 내에서 minMinute <= selectedMinutes 인 위치만 표시
    displayImagesByDateAndTime: function(selectedDate, selectedMinutes) {
        this.markers.clearLayers();

        let centerLatLng = null;
        for (const key in this.locationMap) {
            const loc = this.locationMap[key];
            if (loc.minMinute <= selectedMinutes) {
                const marker = this.createMarker(loc);
                this.markers.addLayer(marker);
                centerLatLng = [loc.lat, loc.lng];
            }
        }

        if (centerLatLng) {
            this.map.setView(centerLatLng, this.map.getZoom());
        } else {
            console.log("선택한 범위 내에 표시할 이미지가 없습니다.");
        }
    },

    // [핵심] locationMap 정보를 받아 마커 생성 + 팝업(해당 위치 이미지들)
    createMarker: function(loc) {
        // 클러스터 아이콘에만 썸네일 사용
        const customIcon = L.icon({
            iconUrl: loc.thumbnailPaths[0], // 썸네일 경로
            iconSize: [50, 50],
            className: 'my-cluster-icon'
        });

        const marker = L.marker([loc.lat, loc.lng], { icon: customIcon });

        // 팝업에 슬라이드쇼 형태로 이미지들 추가
        let popupContent = '<div class="photo-gallery-container">';

        // 시간 순으로 정렬된 이미지들을 슬라이드로 추가
        const sortedByTime = loc.timeArray
            .map((timeVal, idx) => ({ time: timeVal, originalPath: loc.originalPaths[idx] }))
            .sort((a, b) => a.time.localeCompare(b.time));

        if (sortedByTime.length > 1) {
            // 이미지가 2장 이상일 경우에만 이전/다음 버튼 추가
            popupContent += `
              <button class="slide-prev" onclick="prevSlide(this.parentNode)">&#10094;</button>
              <div class="image-slider">
            `;
        } else {
            // 이미지가 1장일 경우 버튼 없이 이미지만 추가
            popupContent += `
              <div class="image-slider single-image">
            `;
        }

        sortedByTime.forEach((item, index) => {
            popupContent += `
                <img src="${item.originalPath}" alt="사진 ${item.time}"
                    class="slide-image${index === 0 ? ' active' : ''}"
                    data-index="${index}"
                    onclick="openImage('${item.originalPath}', this.parentNode)" />
            `;
        });

        popupContent += `</div>`;

        if (sortedByTime.length > 1) {
            popupContent += `
                <button class="slide-next" onclick="nextSlide(this.parentNode)">&#10095;</button>
                <div class="indicators">
                    ${sortedByTime.map((_, idx) => `<span class="indicator${idx === 0 ? ' active' : ''}"></span>`).join('')}
                </div>
            `;
        }

        popupContent += `</div>`;

        marker.bindPopup(popupContent);
        return marker;
    },

    // [Lightbox] 오버레이로 사진 슬라이드쇼 표시
    openImage: function(imagePath, gallery) {
        const existingLightbox = $('#lightbox');
        if (existingLightbox.length) {
            existingLightbox.remove();
        }

        const lightbox = $('<div></div>')
            .attr('id', 'lightbox')
            .addClass('lightbox');

        // gallery 내부의 모든 <img> 태그 경로를 배열화
        let images = Array.from(gallery.querySelectorAll('img'))
            .map(img => img.src.replace('/thumbnails', ''));

        // 클릭된 이미지가 배열에서 몇 번째인지 확인
        const normalizedImagePath = new URL(imagePath, window.location.origin).href;
        const currentIndex = images.indexOf(normalizedImagePath);

        // 슬라이드쇼 HTML 구성
        let sliderHtml = '<div class="image-slider">';

        if (images.length > 1) {
            // 이미지가 2장 이상일 경우에만 이전/다음 버튼 추가
            sliderHtml += `
              <button class="slide-prev" onclick="prevSlide(this.parentNode)">&#10094;</button>
            `;
        } else {
            // 이미지가 1장일 경우 버튼 없이 이미지만 추가
            sliderHtml += `
              <div class="image-slider single-image">
            `;
        }

        images.forEach(function(imgPath, index) {
            sliderHtml += `
                <img src="${imgPath}" alt="큰 이미지" data-index="${index}" 
                    class="slide-image${index === currentIndex ? ' active' : ''}" />
            `;
        });

        // 인디케이터 추가
        if (images.length > 1) {
            sliderHtml += `
            <button class="slide-next" onclick="nextSlide(this.parentNode)">&#10095;</button>
            <div class="indicators">
            ${images.map((_, idx) => `<span class="indicator${idx === currentIndex ? ' active' : ''}"></span>`).join('')}
            </div>
            `;
        }

        sliderHtml += `</div>`;

        lightbox.html(sliderHtml);
        $('body').append(lightbox);

        // 라이트박스 영역(어두운 배경) 클릭 시 닫기
        lightbox.on('click', function(event) {
            if (event.target === lightbox[0]) {
                lightbox.remove();
            }
        });
    },

    // 위치 정보 없는 사진 갤러리 모달 열기 함수
    openNoGpsGalleryModal: function() {
        if (this.noGpsImages.length === 0) {
            alert("위치 정보가 없는 사진이 없습니다.");
            return;
        }

        // 마지막으로 본 페이지로 설정
        this.currentNoGpsGalleryPage = this.lastNoGpsGalleryPage || 1;
        this.updateNoGpsGallerySlider();

        $('#noGpsGalleryModal').fadeIn();
    },

    // 위치 정보 없는 사진 갤러리 슬라이드 업데이트 함수 (페이지네이션)
    updateNoGpsGallerySlider: function() {
        const sliderContainer = $('.noGpsGallery-image-grid');
        const paginationInfo = $('#currentPage');
        const totalPagesInfo = $('#totalPages');
        sliderContainer.empty();

        // 전체 페이지 수 계산
        this.totalNoGpsGalleryPages = Math.ceil(this.noGpsImages.length / this.imagesPerPage);
        totalPagesInfo.text(this.totalNoGpsGalleryPages);

        // 현재 페이지에 해당하는 이미지 추출
        const startIndex = (this.currentNoGpsGalleryPage - 1) * this.imagesPerPage;
        const endIndex = startIndex + this.imagesPerPage;
        const imagesToShow = this.noGpsImages.slice(startIndex, endIndex);

        // 이미지 그리드에 추가
        imagesToShow.forEach((item, index) => {
            sliderContainer.append(`
                <img src="${item.thumbnailPath}" alt="사진 ${item.time}" class="noGpsGallery-image"
                data-index="${startIndex + index}" onclick="openImage('${item.originalPath}', this.parentNode)" />
            `);
        });

        // 현재 페이지 정보 업데이트
        paginationInfo.text(this.currentNoGpsGalleryPage);
    },

    // 위치 정보 없는 사진 갤러리 이전 페이지 함수
    noGpsGalleryPrevPage: function() {
        if (this.currentNoGpsGalleryPage > 1) {
            this.currentNoGpsGalleryPage--;
            this.updateNoGpsGallerySlider();
        }
    },

    // 위치 정보 없는 사진 갤러리 다음 페이지 함수
    noGpsGalleryNextPage: function() {
        if (this.currentNoGpsGalleryPage < this.totalNoGpsGalleryPages) {
            this.currentNoGpsGalleryPage++;
            this.updateNoGpsGallerySlider();
        }
    },

    // 위치 정보 없는 사진 갤러리 특정 페이지로 이동 함수 (필요 시)
    noGpsGalleryGoToPage: function(pageNumber) {
        if (pageNumber >= 1 && pageNumber <= this.totalNoGpsGalleryPages) {
            this.currentNoGpsGalleryPage = pageNumber;
            this.updateNoGpsGallerySlider();
        }
    }
};


/*  
  ▼ 슬라이드쇼 제어 함수들은 HTML에서 직접 onclick으로 호출하고 있으므로
     window 전역에 바인딩하거나, IIFE 형태 등으로 별도 관리할 수도 있습니다.
     여기서는 원본 코드 구조를 최대한 유지하기 위해 그대로 두고,
     PhotoMapApp 내에서 쓰이려면 PhotoMapApp 내 메서드로 옮겨도 됩니다.
*/

// 슬라이드쇼 이전/다음
function prevSlide(slider) {
    const images = $(slider).find('.slide-image');
    const activeImage = $(slider).find('.slide-image.active');
    let currentIndex = parseInt(activeImage.data('index'), 10);

    activeImage.removeClass('active');
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    $(images[currentIndex]).addClass('active');

    // 인디케이터 업데이트
    const indicators = $(slider).find('.indicators .indicator');
    indicators.removeClass('active');
    $(indicators[currentIndex]).addClass('active');
}

function nextSlide(slider) {
    const images = $(slider).find('.slide-image');
    const activeImage = $(slider).find('.slide-image.active');
    let currentIndex = parseInt(activeImage.data('index'), 10);

    activeImage.removeClass('active');
    currentIndex = (currentIndex + 1) % images.length;
    $(images[currentIndex]).addClass('active');

    // 인디케이터 업데이트
    const indicators = $(slider).find('.indicators .indicator');
    indicators.removeClass('active');
    $(indicators[currentIndex]).addClass('active');
}

// Lightbox 열기 함수(동적으로도 호출해야 하므로 window 범위 유지)
function openImage(imagePath, gallery) {
    // PhotoMapApp 객체 메서드로 옮길 수도 있지만,
    // 기존 구조를 살리기 위해 외부 함수 호출 형태로 유지
    PhotoMapApp.openImage(imagePath, gallery);
}

$(document).ready(function () {
    PhotoMapApp.init();
});
