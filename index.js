// 지도 초기화
var map = L.map('map').setView([35.0, 135.0], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// ▼ 마커 클러스터 그룹 생성 + 커스텀 아이콘 로직
var markers = L.markerClusterGroup({
    // ▼ iconCreateFunction: 클러스터 아이콘을 대표 사진으로 생성
    iconCreateFunction: function(cluster) {
        var childMarkers = cluster.getAllChildMarkers();
        // 첫 번째 마커의 iconUrl 얻기
        var firstMarkerIcon = childMarkers[0].options.icon.options.iconUrl;
        // 클러스터에 몇 장이 포함되었는지 숫자
        var childCount = cluster.getChildCount();

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
map.addLayer(markers);

// 전역 변수
var imageData = [];
var locationMap = {}; // { "lat_lng_key": { lat, lng, date, timeArray:[...], thumbnailPaths:[...], originalPaths:[...], minMinute } }
var allDates = new Set();
var currentSelectedDate = null;
var isTimeSliderEnabled = false;

// 위치 정보 없는 사진 갤러리 관련 전역 변수
var noGpsImages = [];
var currentNoGpsGalleryIndex = 0;

// 시간 슬라이더 토글 이벤트 리스너
$('#timeSliderToggle').on('change', function() {
    isTimeSliderEnabled = $(this).prop('checked');
    $('#timeSlider').prop('disabled', !isTimeSliderEnabled);

    if (currentSelectedDate) {
        if (isTimeSliderEnabled) {
            const selectedMinutes = parseInt($('#timeSlider').val(), 10);
            displayImagesByDateAndTime(currentSelectedDate, selectedMinutes);
        } else {
            displayImagesByDate(currentSelectedDate);
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

// 서버에서 EXIF 미리 파싱된 이미지 정보를 불러옴
$.ajax({
    url: '/api/image_data',
    method: 'GET',
    dataType: 'json',
    success: function(data) {
        imageData = data;
        data.forEach(item => {
            if (!item.lat || !item.lng) {
              noGpsImages.push(item);
            } else {
              allDates.add(item.date);
            }
        });

        var sortedDates = Array.from(allDates).sort();
        createDateButtons(sortedDates);
        if (sortedDates.length > 0) {
            // 초기 날짜 버튼 활성화 (디폴트: 첫 번째 날짜)
            currentSelectedDate = sortedDates[0];
            // locationMap 초기화
            buildLocationMap(currentSelectedDate);
            initializeTimeSliderForDate(currentSelectedDate);
            displayImagesByDate(currentSelectedDate);
            $('.date-button').first().addClass('active');
        }

        // GPS 없는 사진 버튼 활성화
        $('#noGpsGalleryButton').on('click', function() {
            openNoGpsGalleryModal();
        });
    },
    error: function(err) {
        console.log("에러 발생:", err);
    }
});

// 날짜 버튼 생성 함수
function createDateButtons(dates) {
    var container = $('#dateButtonsContainer');
    container.empty(); // 혹시 모르니 초기화
    dates.forEach(dateStr => {
        var formattedDate = formatDateButton(dateStr);
        var button = $('<button></button>')
            .text(formattedDate)
            .addClass('date-button')
            .on('click', function() {
                $('.date-button').removeClass('active');
                $(this).addClass('active');
                currentSelectedDate = dateStr;
                buildLocationMap(dateStr);
                initializeTimeSliderForDate(dateStr);
                if (isTimeSliderEnabled) {
                    const selectedMinutes = parseInt($('#timeSlider').val(), 10);
                    displayImagesByDateAndTime(dateStr, selectedMinutes);
                } else {
                    displayImagesByDate(dateStr);
                }
            });
        container.append(button);
    });
}

// 날짜 버튼에 보여줄 텍스트 포맷 (예: 08/02(월))
function formatDateButton(dateStr) {
    var date = new Date(dateStr);
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    var dayOfWeek = getKoreanDayOfWeek(date.getDay());
    return `${month}/${day}(${dayOfWeek})`;
}

function getKoreanDayOfWeek(day) {
    var days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[day];
}

// [핵심 변경] 특정 날짜에 대한 locationMap을 만들어서
// 같은 좌표의 사진을 묶고, 그 중 "가장 빠른 시간(minMinute)"을 별도로 계산
function buildLocationMap(selectedDate) {
    locationMap = {};
    var filtered = imageData.filter(item => item.date === selectedDate && item.lat && item.lng);

    filtered.forEach(item => {
        // 소수점 5자리로 좌표를 묶음(정확도 조절 가능)
        var key = item.lat.toFixed(5) + "," + item.lng.toFixed(5);

        if (!locationMap[key]) {
            locationMap[key] = {
                lat: item.lat,
                lng: item.lng,
                date: item.date,
                timeArray: [],
                thumbnailPaths: [],
                originalPaths: [],
                minMinute: 1440 // 초기값 큰 수
            };
        }
        locationMap[key].timeArray.push(item.time);
        locationMap[key].thumbnailPaths.push(item.thumbnailPath);
        locationMap[key].originalPaths.push(item.originalPath);

        // 가장 빠른 시간(분) 계산
        const [hh, mm] = item.time.split(':').map(Number);
        const itemMinutes = hh * 60 + mm;
        if (itemMinutes < locationMap[key].minMinute) {
            locationMap[key].minMinute = itemMinutes;
        }
    });
}

// 선택된 날짜에 대해 시간 슬라이더 설정
function initializeTimeSliderForDate(selectedDate) {
    // locationMap에 있는 각 좌표 그룹의 minMinute들을 추출
    var minMinutesArray = Object.keys(locationMap)
        .map(key => locationMap[key].minMinute)
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
    $('#timeSlider').attr('disabled', !isTimeSliderEnabled);
    $('#timeSlider').attr('min', 0);
    $('#timeSlider').attr('max', 100);
    $('#timeSlider').val(0);
    updateTimeLabel(minMinutesArray[0]);

    // 슬라이더 이벤트 핸들러
    $('#timeSlider').off('input').on('input', function() {
        const currentValue = parseFloat($(this).val());
        // 균등 간격의 틱 중 가장 가까운 인덱스 찾기
        const closestIndex = Math.round(currentValue / interval);
        const closestTickValue = closestIndex * interval;
        $(this).val(closestTickValue);
        // 해당 인덱스의 실제 시간(분) 가져오기
        const selectedMinutes = minMinutesArray[closestIndex];
        updateTimeLabel(selectedMinutes);
            if (isTimeSliderEnabled) {
            displayImagesByDateAndTime(selectedDate, selectedMinutes);
        }
    });
}

function updateTimeLabel(minutes) {
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    $('#timeLabel').text(`${hh}:${mm}`);
}

// [수정] 날짜만 활성화된 경우(시간 필터 X), 해당 날짜 locationMap 기반 마커 표시
function displayImagesByDate(selectedDate) {
    markers.clearLayers();

    // locationMap에 있는 모든 좌표를 순회하며 마커 생성
    for (var key in locationMap) {
        var loc = locationMap[key];
        var marker = createMarker(loc);
        markers.addLayer(marker);
    }

    // 지도 범위 맞춤
    if (markers.getLayers().length > 0) {
        map.fitBounds(markers.getBounds());
    } else {
        console.log("선택한 날짜에 표시할 위치가 없습니다.");
    }
}

// [수정] 날짜 + 시간 슬라이더 활성화 시, locationMap 내에서 minMinute <= selectedMinutes 인 위치만 표시
function displayImagesByDateAndTime(selectedDate, selectedMinutes) {
    markers.clearLayers();

    var centerLatLng = null;
    for (var key in locationMap) {
        var loc = locationMap[key];
        if (loc.minMinute <= selectedMinutes) {
            var marker = createMarker(loc);
            markers.addLayer(marker);
            centerLatLng = [loc.lat, loc.lng];
        }
    }

    if (centerLatLng) {
        map.setView(centerLatLng, map.getZoom());
    } else {
        console.log("선택한 범위 내에 표시할 이미지가 없습니다.");
    }
}

// [핵심] locationMap 정보를 받아 마커 생성 + 팝업(해당 위치 이미지들)
function createMarker(loc) {
    // 클러스터 아이콘에만 썸네일 사용
    var customIcon = L.icon({
        iconUrl: loc.thumbnailPaths[0], // 썸네일 경로
        iconSize: [50, 50],
        className: 'my-cluster-icon'
    });

    var marker = L.marker([loc.lat, loc.lng], { icon: customIcon });

    // 팝업에 슬라이드쇼 형태로 이미지들 추가
    var popupContent = '<div class="photo-gallery-container">';

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
        popupContent += `<img src="${item.originalPath}" alt="사진 ${item.time}" class="slide-image${index === 0 ? ' active' : ''}" data-index="${index}" onclick="openImage('${item.originalPath}', this.parentNode)" />`;
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
}


// [Lightbox] 오버레이로 사진 슬라이드쇼 표시
function openImage(imagePath, gallery) {
    var existingLightbox = $('#lightbox');
    if (existingLightbox.length) {
        existingLightbox.remove();
    }

    const lightbox = $('<div></div>')
        .attr('id', 'lightbox')
        .addClass('lightbox');

    // gallery 내부의 모든 <img> 태그 경로를 배열화
    let images = Array.from(gallery.querySelectorAll('img')).map(img => img.src);

    // 클릭된 이미지가 배열에서 몇 번째인지 확인
    const normalizedImagePath = new URL(imagePath, window.location.origin).href;
    const currentIndex = images.indexOf(normalizedImagePath);

    // 슬라이드쇼 HTML 구성
    let sliderHtml = '<div class="image-slider">';
    images.forEach(function(imgPath, index) {
        sliderHtml += `
            <img src="${imgPath}" alt="큰 이미지" data-index="${index}" 
                class="slide-image${index === currentIndex ? ' active' : ''}" />
        `;
    });
    sliderHtml += `
        <button class="slide-prev" onclick="prevSlide(this.parentNode)">&#10094;</button>
        <button class="slide-next" onclick="nextSlide(this.parentNode)">&#10095;</button>
    `;

    // 인디케이터 추가
    if (images.length > 1) {
        sliderHtml += `
            <div class="indicators">
                ${images.map((_, idx) => `<span class="indicator${idx === currentIndex ? ' active' : ''}"></span>`).join('')}
            </div>
        `;
    }

    sliderHtml += '</div>';

    lightbox.html(sliderHtml);
    $('body').append(lightbox);

    // 라이트박스 영역(어두운 배경) 클릭 시 닫기
    lightbox.on('click', function(event) {
        if (event.target === lightbox[0]) {
            lightbox.remove();
        }
    });
}

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

// 위치 정보 없는 사진 갤러리 모달 열기 함수
function openNoGpsGalleryModal() {
    if (noGpsImages.length === 0) {
        alert("위치 정보가 없는 사진이 없습니다.");
        return;
    }

    currentNoGpsGalleryIndex = 0;
    updateNoGpsGallerySlider();

    $('#noGpsGalleryModal').fadeIn();
}

// 위치 정보 없는 사진 갤러리 모달 닫기 함수
$('.close-button').on('click', function() {
    $('#noGpsGalleryModal').fadeOut();
});

// 위치 정보 없는 사진 갤러리 슬라이드 업데이트 함수
function updateNoGpsGallerySlider() {
    var sliderContainer = $('.noGpsGallery-image-slider');
    var indicatorsContainer = $('.noGpsGallery-indicators');
    sliderContainer.empty();
    indicatorsContainer.empty();

    noGpsImages.forEach((item, index) => {
        sliderContainer.append(`
            <img src="${item.originalPath}" alt="사진 ${item.time}" class="noGpsGallery-slide-image${index === currentNoGpsGalleryIndex ? ' active' : ''}" data-index="${index}" onclick="openImage('${item.originalPath}', this.parentNode)" />
        `);
        indicatorsContainer.append(`
            <span class="noGpsGallery-indicator${index === currentNoGpsGalleryIndex ? ' active' : ''}" onclick="noGpsGalleryGoToSlide(${index})"></span>
        `);
    });
}

// 위치 정보 없는 사진 갤러리 이전 슬라이드 함수
function noGpsGalleryPrevSlide() {
    if (noGpsImages.length === 0) return;
    currentNoGpsGalleryIndex = (currentNoGpsGalleryIndex - 1 + noGpsImages.length) % noGpsImages.length;
    updateNoGpsGallerySlider();
}

// 위치 정보 없는 사진 갤러리 다음 슬라이드 함수
function noGpsGalleryNextSlide() {
    if (noGpsImages.length === 0) return;
    currentNoGpsGalleryIndex = (currentNoGpsGalleryIndex + 1) % noGpsImages.length;
    updateNoGpsGallerySlider();
}

// 위치 정보 없는 사진 갤러리 특정 슬라이드로 이동 함수
function noGpsGalleryGoToSlide(index) {
    currentNoGpsGalleryIndex = index;
    updateNoGpsGallerySlider();
}