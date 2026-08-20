/**
 * [오늘 뭐 볼까?] - 애플리케이션 프론트엔드 컨트롤러 (app.js)
 * 
 * 1. 직관적인 '웹툰만 추천', '영화만 추천', '둘 다 함께 보기' 맞춤 모드 전환
 * 2. URL 파라미터 기반 딥링크(Deep Link) 및 원클릭 추천 결과 공유 시스템
 * 3. 최근 추천 기록 (히스토리) 누적 및 과거 검색 원클릭 재호출
 * 4. 내가 저장한 목록 (보관함) 관리 (작품명 - 종류 - 조회수 트래킹)
 * 5. 카드 줄거리 펼치기/접기 및 작품 상세 정보 모달 팝업 연동
 */

// ==========================================
// 1. DOM 요소 참조
// ==========================================
const contentInput = document.getElementById('contentInput');
const contentInputLabel = document.getElementById('contentInputLabel');
const autocompleteList = document.getElementById('autocompleteList');
const categoryTabs = document.getElementById('categoryTabs');
const quickPicksList = document.getElementById('quickPicksList');
const moodTagsGrid = document.getElementById('moodTagsGrid');
const btnRecommend = document.getElementById('btnRecommend');
const btnRecommendText = document.getElementById('btnRecommendText');
const loadingContainer = document.getElementById('loadingContainer');
const resultsSection = document.getElementById('resultsSection');
const targetContentName = document.getElementById('targetContentName');
const btnShareResult = document.getElementById('btnShareResult');
const toastContainer = document.getElementById('toastContainer');

// 분리된 영화/웹툰 추천 섹션 DOM
const webtoonsResultsSection = document.getElementById('webtoonsResultsSection');
const webtoonsCardsGrid = document.getElementById('webtoonsCardsGrid');
const webtoonsCountBadge = document.getElementById('webtoonsCountBadge');

const moviesResultsSection = document.getElementById('moviesResultsSection');
const moviesCardsGrid = document.getElementById('moviesCardsGrid');
const moviesCountBadge = document.getElementById('moviesCountBadge');

// 저장 목록 모달 관련 DOM
const btnOpenSavedModal = document.getElementById('btnOpenSavedModal');
const btnCloseSavedModal = document.getElementById('btnCloseSavedModal');
const savedModalOverlay = document.getElementById('savedModalOverlay');
const savedListContainer = document.getElementById('savedListContainer');
const headerSavedCount = document.getElementById('headerSavedCount');

// 최근 추천 기록 (히스토리) 모달 관련 DOM
const btnOpenHistoryModal = document.getElementById('btnOpenHistoryModal');
const btnCloseHistoryModal = document.getElementById('btnCloseHistoryModal');
const historyModalOverlay = document.getElementById('historyModalOverlay');
const historyListContainer = document.getElementById('historyListContainer');

// 작품 상세 정보 모달 관련 DOM
const detailModalOverlay = document.getElementById('detailModalOverlay');
const btnCloseDetailModal = document.getElementById('btnCloseDetailModal');
const detailModalBody = document.getElementById('detailModalBody');
const detailModalHeaderTitle = document.getElementById('detailModalHeaderTitle');

// ==========================================
// 2. 모드별 UI 프리셋 설정 (웹툰 / 영화 / 전체)
// ==========================================
const MODE_PRESETS = {
    webtoon: {
        label: "내가 가장 재밌게 본 웹툰은?",
        placeholder: "예: 전지적 독자 시점, 화산귀환, 나 혼자만 레벨업 등 입력...",
        btnText: "⚡ 웹툰 맞춤 추천받기",
        defaultQuery: "전지적 독자 시점",
        quickPicks: [
            "전지적 독자 시점",
            "화산귀환",
            "나 혼자만 레벨업",
            "가비지타임 (Garbage Time)",
            "유미의 세포들",
            "신의 탑",
            "광마회귀",
            "호랑이형님"
        ]
    },
    movie: {
        label: "내가 가장 재밌게 본 영화는?",
        placeholder: "예: 인셉션, 라라랜드, 서울의 봄, 기생충 등 입력...",
        btnText: "⚡ 영화 맞춤 추천받기",
        defaultQuery: "인셉션 (Inception)",
        quickPicks: [
            "인셉션 (Inception)",
            "라라랜드 (La La Land)",
            "서울의 봄 (12.12: The Day)",
            "기생충 (Parasite)",
            "인터스텔라 (Interstellar)",
            "헤어질 결심",
            "너의 이름은. (Your Name)",
            "아바타: 물의 길 (Avatar 2)"
        ]
    },
    all: {
        label: "내가 가장 재밌게 본 인생작(웹툰/영화)은?",
        placeholder: "예: 전지적 독자 시점, 인셉션, 화산귀환, 라라랜드 등...",
        btnText: "⚡ 웹툰 & 영화 함께 추천받기",
        defaultQuery: "전지적 독자 시점",
        quickPicks: [
            "전지적 독자 시점",
            "인셉션 (Inception)",
            "화산귀환",
            "라라랜드 (La La Land)",
            "나 혼자만 레벨업",
            "서울의 봄 (12.12: The Day)"
        ]
    }
};

// ==========================================
// 3. 스토리지 키 및 전역 상태 관리
// ==========================================
const STORAGE_SAVED_KEY = 'today_watch_saved_items_v1';
const STORAGE_VIEWS_KEY = 'today_watch_view_counts_v1';
const STORAGE_HISTORY_KEY = 'today_watch_history_v1';

let currentFilterType = 'webtoon'; // 기본 모드: 'webtoon' (웹툰만 찾기)
let selectedMoodTags = new Set();  // 사용자가 선택한 감성 태그 집합
let lastRecommendedTarget = null;  // 가장 최근에 추천 완료된 기준 작품 정보

// 저장된 작품 ID 목록 (Set)
let savedItemIds = new Set(loadFromStorage(STORAGE_SAVED_KEY, []));

// 작품별 조회수 맵 { "m1": 5, "w2": 8 }
let contentViewsMap = loadFromStorage(STORAGE_VIEWS_KEY, {});

// 최근 추천 기록 목록 [{ id, targetTitle, mode, tags, timestamp, topTitles }]
let recHistoryList = loadFromStorage(STORAGE_HISTORY_KEY, []);

// ==========================================
// 4. 초기화 (Initialization)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1) 헤더 보관함 뱃지 숫자 갱신
    updateSavedHeaderCount();

    // 2) 분위기/감성 태그 칩 렌더링
    renderMoodTags();

    // 3) 대형 모드 선택 탭 클릭 이벤트 등록
    setupModeTabs();

    // 4) URL 공유 딥링크(Query Params) 확인 및 복원
    const urlParams = new URLSearchParams(window.location.search);
    const paramTarget = urlParams.get('target');
    const paramMode = urlParams.get('mode');
    const paramTags = urlParams.get('tags');

    if (paramMode && ['webtoon', 'movie', 'all'].includes(paramMode)) {
        currentFilterType = paramMode;
        selectTabButton(paramMode);
    }
    applyModePreset(currentFilterType);

    if (paramTags) {
        paramTags.split(',').forEach(tag => {
            const trimmed = tag.trim();
            if (trimmed) selectedMoodTags.add(trimmed);
        });
        syncMoodTagChips();
    }

    if (paramTarget) {
        contentInput.value = paramTarget;
    }

    // 5) 검색창 실시간 자동완성 이벤트 등록
    setupAutocomplete();

    // 6) 추천 실행 버튼 이벤트 등록
    btnRecommend.addEventListener('click', () => handleRecommendation(true));

    // 7) 결과 공유하기 버튼 이벤트 등록
    btnShareResult.addEventListener('click', handleShareCurrentResult);

    // 8) 엔터키 입력 시 추천 실행
    contentInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleRecommendation(true);
        }
    });

    // 9) 저장 목록 모달 이벤트
    btnOpenSavedModal.addEventListener('click', openSavedModal);
    btnCloseSavedModal.addEventListener('click', closeSavedModal);
    savedModalOverlay.addEventListener('click', (e) => {
        if (e.target === savedModalOverlay) closeSavedModal();
    });

    // 10) 최근 추천 기록 모달 이벤트
    btnOpenHistoryModal.addEventListener('click', openHistoryModal);
    btnCloseHistoryModal.addEventListener('click', closeHistoryModal);
    historyModalOverlay.addEventListener('click', (e) => {
        if (e.target === historyModalOverlay) closeHistoryModal();
    });

    // 11) 상세 모달 이벤트
    btnCloseDetailModal.addEventListener('click', closeDetailModal);
    detailModalOverlay.addEventListener('click', (e) => {
        if (e.target === detailModalOverlay) closeDetailModal();
    });

    // ESC 키로 모든 모달 닫기
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSavedModal();
            closeHistoryModal();
            closeDetailModal();
        }
    });

    // 12) 추천 1회 자동 실행
    handleRecommendation(false);
});

// ==========================================
// 5. 모드 전환 및 프리셋 동기화
// ==========================================
function setupModeTabs() {
    const tabButtons = categoryTabs.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            currentFilterType = btn.getAttribute('data-type');
            applyModePreset(currentFilterType);

            // 모드 변경 시 즉시 맞춤 추천 다시 실행
            handleRecommendation(true);
        });
    });
}

function selectTabButton(mode) {
    const tabButtons = categoryTabs.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        if (btn.getAttribute('data-type') === mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function applyModePreset(mode) {
    const preset = MODE_PRESETS[mode] || MODE_PRESETS.webtoon;

    contentInputLabel.textContent = preset.label;
    contentInput.placeholder = preset.placeholder;
    btnRecommendText.textContent = preset.btnText;
    contentInput.value = preset.defaultQuery;

    // 추천 키워드 칩 재렌더링
    quickPicksList.innerHTML = '';
    preset.quickPicks.forEach(title => {
        const btn = document.createElement('button');
        btn.className = 'quick-pick-btn';
        btn.textContent = title.replace(/\s\(.*\)/, '');
        btn.addEventListener('click', () => {
            contentInput.value = title;
            handleRecommendation(true);
        });
        quickPicksList.appendChild(btn);
    });
}

// ==========================================
// 6. 로컬 스토리지 & 토스트 알림 헬퍼
// ==========================================
function loadFromStorage(key, defaultValue) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.error("LocalStorage 로드 실패:", e);
        return defaultValue;
    }
}

function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error("LocalStorage 저장 실패:", e);
    }
}

// 화면 중앙 하단 토스트 알림 표시 함수
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.innerHTML = `<span>✨</span> <span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 3000);
}

// 작품 조회수 1 증가 함수
function incrementViewCount(contentId) {
    if (!contentViewsMap[contentId]) {
        contentViewsMap[contentId] = 1;
    } else {
        contentViewsMap[contentId] += 1;
    }
    saveToStorage(STORAGE_VIEWS_KEY, contentViewsMap);
}

function updateSavedHeaderCount() {
    headerSavedCount.textContent = savedItemIds.size;
}

// ==========================================
// 7. 감성 태그 렌더링 및 동기화
// ==========================================
function renderMoodTags() {
    moodTagsGrid.innerHTML = '';
    
    MOOD_TAG_OPTIONS.forEach(tag => {
        const chip = document.createElement('button');
        chip.className = 'mood-tag-chip';
        chip.textContent = tag;
        
        chip.addEventListener('click', () => {
            if (selectedMoodTags.has(tag)) {
                selectedMoodTags.delete(tag);
                chip.classList.remove('active');
            } else {
                selectedMoodTags.add(tag);
                chip.classList.add('active');
            }

            if (contentInput.value.trim() !== '') {
                handleRecommendation(true);
            }
        });

        moodTagsGrid.appendChild(chip);
    });
}

function syncMoodTagChips() {
    const chips = moodTagsGrid.querySelectorAll('.mood-tag-chip');
    chips.forEach(chip => {
        if (selectedMoodTags.has(chip.textContent.trim())) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });
}

// ==========================================
// 8. 검색어 실시간 자동완성
// ==========================================
function setupAutocomplete() {
    contentInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        
        if (query.length === 0) {
            autocompleteList.style.display = 'none';
            return;
        }

        const matches = CONTENT_DATABASE.filter(item => {
            if (currentFilterType !== 'all' && item.type !== currentFilterType) {
                return false;
            }
            return (
                item.title.toLowerCase().includes(query) ||
                item.genres.some(g => g.toLowerCase().includes(query)) ||
                item.keywords.some(k => k.toLowerCase().includes(query))
            );
        });

        if (matches.length > 0) {
            autocompleteList.innerHTML = '';
            matches.slice(0, 5).forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'autocomplete-item';
                
                const typeText = item.type === 'movie' ? '🎬 영화' : '📱 웹툰';
                itemEl.innerHTML = `
                    <span class="autocomplete-title">${item.title}</span>
                    <span class="autocomplete-badge">${typeText}</span>
                `;

                itemEl.addEventListener('click', () => {
                    contentInput.value = item.title;
                    autocompleteList.style.display = 'none';
                    handleRecommendation(true);
                });

                autocompleteList.appendChild(itemEl);
            });
            autocompleteList.style.display = 'block';
        } else {
            autocompleteList.style.display = 'none';
        }
    });

    document.addEventListener('click', (e) => {
        if (!contentInput.contains(e.target) && !autocompleteList.contains(e.target)) {
            autocompleteList.style.display = 'none';
        }
    });
}

// ==========================================
// 9. 추천 실행 핸들러 & 히스토리 기록 누적
// ==========================================
function handleRecommendation(isUserTriggered = true) {
    const query = contentInput.value.trim();

    if (!query) {
        if (isUserTriggered) {
            alert('내가 재밌게 본 인생작 제목을 입력해 주세요!');
            contentInput.focus();
        }
        return;
    }

    autocompleteList.style.display = 'none';
    loadingContainer.style.display = 'block';
    resultsSection.style.display = 'none';

    setTimeout(() => {
        const result = getRecommendations(
            query, 
            currentFilterType, 
            Array.from(selectedMoodTags),
            20
        );

        loadingContainer.style.display = 'none';

        if (!result.success) {
            if (isUserTriggered) alert(result.message);
            return;
        }

        // 기준 작품 조회수 및 상태 저장
        lastRecommendedTarget = result.targetContent;
        incrementViewCount(result.targetContent.id);

        // URL 히스토리 쿼리스트링 갱신 (뒤로가기/공유 지원)
        updateUrlParams(result.targetContent.title, currentFilterType, Array.from(selectedMoodTags));

        // 최근 추천 기록(히스토리)에 저장
        if (isUserTriggered) {
            saveToRecHistory(result);
        }

        // 결과 화면 렌더링
        renderRecommendationResults(result);
        resultsSection.style.display = 'block';
    }, 200);
}

// URL 쿼리 파라미터 업데이트 함수
function updateUrlParams(targetTitle, mode, tags) {
    const url = new URL(window.location);
    url.searchParams.set('target', targetTitle);
    url.searchParams.set('mode', mode);
    if (tags.length > 0) {
        url.searchParams.set('tags', tags.join(','));
    } else {
        url.searchParams.delete('tags');
    }
    window.history.replaceState({}, '', url);
}

// 최근 추천 기록에 누적 저장
function saveToRecHistory(result) {
    const target = result.targetContent;
    const topTitles = [
        ...result.webtoons.slice(0, 3).map(w => w.title),
        ...result.movies.slice(0, 3).map(m => m.title)
    ].slice(0, 3);

    const newHistoryItem = {
        id: Date.now().toString(),
        targetTitle: target.title,
        targetType: target.type,
        mode: currentFilterType,
        tags: Array.from(selectedMoodTags),
        timestamp: new Date().toLocaleDateString('ko-KR', {
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }),
        topTitles
    };

    // 중복 제거 후 맨 앞에 추가 (최대 20개 보관)
    recHistoryList = recHistoryList.filter(h => h.targetTitle !== target.title || h.mode !== currentFilterType);
    recHistoryList.unshift(newHistoryItem);
    if (recHistoryList.length > 20) recHistoryList.pop();

    saveToStorage(STORAGE_HISTORY_KEY, recHistoryList);
}

// ==========================================
// 10. 맞춤 추천 결과 원클릭 공유 시스템 (Deep Link)
// ==========================================
function handleShareCurrentResult() {
    if (!lastRecommendedTarget) {
        showToast('먼저 작품을 추천받은 후 공유해 주세요!');
        return;
    }

    const shareUrl = window.location.href;
    const typeText = currentFilterType === 'webtoon' ? '웹툰' : (currentFilterType === 'movie' ? '영화' : '콘텐츠');
    const shareTitle = `🍿 [오늘 뭐 볼까?] '${lastRecommendedTarget.title}' 맞춤 ${typeText} 추천 결과`;
    const shareText = `'${lastRecommendedTarget.title}'와(과) 분위기·장르가 딱 맞는 명작 리스트를 확인해 보세요!\n👉 ${shareUrl}`;

    // 모바일 네이티브 공유 지원 시
    if (navigator.share) {
        navigator.share({
            title: shareTitle,
            text: shareText,
            url: shareUrl
        }).catch(() => {
            // 취소 시 클립보드 복사로 대체
            copyToClipboard(shareUrl);
        });
    } else {
        // PC 브라우저 클립보드 복사
        copyToClipboard(shareUrl);
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('🔗 맞춤 추천 결과 링크가 복사되었습니다! 친구에게 붙여넣기(Ctrl+V)하세요.');
        }).catch(() => {
            fallbackCopyText(text);
        });
    } else {
        fallbackCopyText(text);
    }
}

function fallbackCopyText(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showToast('🔗 추천 링크가 복사되었습니다!');
    } catch (e) {
        alert('링크를 복사해주세요: ' + text);
    }
    document.body.removeChild(textArea);
}

// ==========================================
// 11. 추천 결과 동적 렌더링
// ==========================================
function renderRecommendationResults(result) {
    const { targetContent, movies, webtoons, filterType } = result;

    // 상단 기준작 텍스트
    let targetSubText = `[${targetContent.type === 'movie' ? '🎬 영화' : '📱 웹툰'}] ${targetContent.title}`;
    if (selectedMoodTags.size > 0) {
        targetSubText += ` + 선택 태그 [${Array.from(selectedMoodTags).join(', ')}]`;
    }
    targetContentName.textContent = targetSubText;

    // 1) 📱 웹툰 섹션 렌더링 제어
    if (filterType === 'movie') {
        webtoonsResultsSection.style.display = 'none';
    } else {
        webtoonsResultsSection.style.display = 'block';
        webtoonsCountBadge.textContent = `${webtoons.length}편`;
        webtoonsCardsGrid.innerHTML = '';

        if (webtoons.length === 0) {
            webtoonsCardsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 2.5rem; color: var(--text-dim);">
                    추천 기준에 일치하는 웹툰이 없습니다.
                </div>
            `;
        } else {
            webtoons.forEach(item => {
                const cardEl = createCardElement(item);
                webtoonsCardsGrid.appendChild(cardEl);
            });
        }
    }

    // 2) 🎬 영화 섹션 렌더링 제어
    if (filterType === 'webtoon') {
        moviesResultsSection.style.display = 'none';
    } else {
        moviesResultsSection.style.display = 'block';
        moviesCountBadge.textContent = `${movies.length}편`;
        moviesCardsGrid.innerHTML = '';

        if (movies.length === 0) {
            moviesCardsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 2.5rem; color: var(--text-dim);">
                    추천 기준에 일치하는 영화가 없습니다.
                </div>
            `;
        } else {
            movies.forEach(item => {
                const cardEl = createCardElement(item);
                moviesCardsGrid.appendChild(cardEl);
            });
        }
    }
}

// ==========================================
// 11-1. 단일 카드 생성 헬퍼 함수
// ==========================================
function createCardElement(item) {
    const card = document.createElement('div');
    card.className = 'content-card';

    const typeLabel = item.type === 'movie' ? '🎬 영화' : '📱 웹툰';
    const isSaved = savedItemIds.has(item.id);
    const views = contentViewsMap[item.id] || 0;

    // 태그 하이라이트 구성
    const tagsHtml = [
        ...item.moodTags.map(tag => {
            let isMatched = false;
            if (selectedMoodTags.size > 0) {
                isMatched = selectedMoodTags.has(tag);
            } else {
                isMatched = item.commonMoods && item.commonMoods.includes(tag);
            }
            return `<span class="tag-item ${isMatched ? 'matched' : ''}">${tag}</span>`;
        }),
        ...item.genres.map(genre => {
            const isMatched = item.commonGenres && item.commonGenres.includes(genre);
            return `<span class="tag-item ${isMatched ? 'matched' : ''}">#${genre}</span>`;
        })
    ].join('');

    card.innerHTML = `
        <div class="card-poster-wrapper">
            <img class="card-poster" src="${item.poster}" alt="${item.title}" loading="lazy" />
            <div class="card-poster-overlay"></div>
            <span class="type-pill">${typeLabel}</span>
            <div class="similarity-badge" title="종합 유사도 점수">
                <span class="similarity-score">${item.similarity}</span>
                <span class="similarity-unit">점 일치</span>
            </div>
            <!-- 찜/저장 버튼 -->
            <button class="btn-bookmark ${isSaved ? 'saved' : ''}" data-id="${item.id}" title="${isSaved ? '보관함에서 삭제' : '내 보관함에 저장'}">
                ${isSaved ? '★' : '☆'}
            </button>
        </div>
        
        <div class="card-body">
            <h4 class="card-title">${item.title}</h4>
            <div class="card-meta">
                <span>${item.category}</span>
                <span>•</span>
                <span>${item.releaseYear}년</span>
                <span>•</span>
                <span class="card-rating">★ ${item.rating}</span>
                <span>•</span>
                <span class="card-view-count">조회수 ${views}회</span>
            </div>

            <div class="match-reason-box">
                💡 <strong>추천 이유:</strong> ${item.matchReason}
            </div>

            <!-- 줄거리 영역 및 더보기/접기 버튼 -->
            <div class="card-summary-wrapper">
                <p class="card-summary">${item.summary}</p>
                <button class="btn-summary-more">줄거리 전체보기 ▾</button>
            </div>

            <div class="card-tags">
                ${tagsHtml}
            </div>
        </div>
    `;

    // 1) 찜 버튼 클릭 이벤트
    const btnBookmark = card.querySelector('.btn-bookmark');
    btnBookmark.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSaveContent(item.id, btnBookmark);
    });

    // 2) 줄거리 더보기/접기 클릭 이벤트
    const summaryEl = card.querySelector('.card-summary');
    const btnMore = card.querySelector('.btn-summary-more');
    btnMore.addEventListener('click', (e) => {
        e.stopPropagation();
        if (summaryEl.classList.contains('expanded')) {
            summaryEl.classList.remove('expanded');
            btnMore.textContent = '줄거리 전체보기 ▾';
        } else {
            summaryEl.classList.add('expanded');
            btnMore.textContent = '줄거리 접기 ▴';
        }
    });

    // 3) 카드 본문 클릭 시 [작품 상세 모달 팝업] 열기
    card.addEventListener('click', () => {
        incrementViewCount(item.id);
        const viewCountEl = card.querySelector('.card-view-count');
        if (viewCountEl) {
            viewCountEl.textContent = `조회수 ${contentViewsMap[item.id] || 0}회`;
        }
        openDetailModal(item.id);
    });

    return card;
}

// ==========================================
// 12. 찜하기(저장) 토글 함수
// ==========================================
function toggleSaveContent(contentId, buttonEl) {
    incrementViewCount(contentId);

    if (savedItemIds.has(contentId)) {
        savedItemIds.delete(contentId);
        if (buttonEl) {
            buttonEl.classList.remove('saved');
            buttonEl.innerHTML = '☆';
            buttonEl.title = '내 보관함에 저장';
        }
        showToast('보관함에서 제거되었습니다.');
    } else {
        savedItemIds.add(contentId);
        if (buttonEl) {
            buttonEl.classList.add('saved');
            buttonEl.innerHTML = '★';
            buttonEl.title = '보관함에서 삭제';
        }
        showToast('⭐ 내 보관함에 저장되었습니다!');
    }

    saveToStorage(STORAGE_SAVED_KEY, Array.from(savedItemIds));
    updateSavedHeaderCount();
}

// ==========================================
// 13. 내가 저장한 목록 모달 열기 및 렌더링
// ==========================================
function openSavedModal() {
    renderSavedList();
    savedModalOverlay.style.display = 'flex';
}

function closeSavedModal() {
    savedModalOverlay.style.display = 'none';
}

function renderSavedList() {
    savedListContainer.innerHTML = '';

    if (savedItemIds.size === 0) {
        savedListContainer.innerHTML = `
            <div class="empty-saved-box">
                <div class="empty-saved-icon">📑</div>
                <p style="font-weight: 600; font-size: 1.1rem; margin-bottom: 0.3rem;">아직 저장한 작품이 없습니다</p>
                <p style="font-size: 0.85rem;">추천 결과 카드에서 별(☆) 버튼을 눌러 마음에 드는 작품을 담아보세요!</p>
            </div>
        `;
        return;
    }

    const savedContents = Array.from(savedItemIds)
        .map(id => CONTENT_DATABASE.find(item => item.id === id))
        .filter(item => item !== undefined);

    savedContents.sort((a, b) => {
        const viewsA = contentViewsMap[a.id] || 0;
        const viewsB = contentViewsMap[b.id] || 0;
        return viewsB - viewsA;
    });

    savedContents.forEach(item => {
        const row = document.createElement('div');
        row.className = 'saved-item-row';

        const isMovie = item.type === 'movie';
        const typeBadge = isMovie 
            ? '<span class="type-badge-movie">🎬 영화</span>' 
            : '<span class="type-badge-webtoon">📱 웹툰</span>';
        
        const views = contentViewsMap[item.id] || 0;

        row.innerHTML = `
            <div class="saved-col-title">
                <img src="${item.poster}" alt="${item.title}" class="saved-poster-thumb" />
                <div>
                    <div class="saved-title-text">${item.title}</div>
                    <div class="saved-category-subtext">${item.category} • ★ ${item.rating}</div>
                </div>
            </div>
            <div class="saved-col-type">${typeBadge}</div>
            <div class="saved-col-views">조회수 ${views}회</div>
            <div class="saved-col-actions">
                <button class="btn-action-recommend" data-title="${item.title}" title="이 작품 기준으로 다시 추천">
                    ⚡ 추천
                </button>
                <button class="btn-action-delete" data-id="${item.id}" title="보관함에서 삭제">
                    삭제
                </button>
            </div>
        `;

        row.querySelector('.saved-col-title').addEventListener('click', (e) => {
            e.stopPropagation();
            closeSavedModal();
            openDetailModal(item.id);
        });

        const btnRec = row.querySelector('.btn-action-recommend');
        btnRec.addEventListener('click', (e) => {
            e.stopPropagation();
            contentInput.value = item.title;
            closeSavedModal();
            handleRecommendation(true);
        });

        const btnDel = row.querySelector('.btn-action-delete');
        btnDel.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSaveContent(item.id, null);
            renderSavedList();
            
            const cardBookmarks = document.querySelectorAll(`.btn-bookmark[data-id="${item.id}"]`);
            cardBookmarks.forEach(b => {
                b.classList.remove('saved');
                b.innerHTML = '☆';
            });
        });

        savedListContainer.appendChild(row);
    });
}

// ==========================================
// 14. [최근 추천 기록 (히스토리) 모달] 열기 및 렌더링
// ==========================================
function openHistoryModal() {
    renderHistoryList();
    historyModalOverlay.style.display = 'flex';
}

function closeHistoryModal() {
    historyModalOverlay.style.display = 'none';
}

function renderHistoryList() {
    historyListContainer.innerHTML = '';

    if (recHistoryList.length === 0) {
        historyListContainer.innerHTML = `
            <div class="empty-saved-box">
                <div class="empty-saved-icon">🕒</div>
                <p style="font-weight: 600; font-size: 1.1rem; margin-bottom: 0.3rem;">아직 추천받은 기록이 없습니다</p>
                <p style="font-size: 0.85rem;">좋아하는 작품을 검색해 추천을 받아보세요! 기록이 여기에 자동으로 남습니다.</p>
            </div>
        `;
        return;
    }

    recHistoryList.forEach(item => {
        const card = document.createElement('div');
        card.className = 'history-item-card';

        const modeText = item.mode === 'webtoon' ? '📱 웹툰만' : (item.mode === 'movie' ? '🎬 영화만' : '✨ 둘 다');
        const tagsSummary = item.tags && item.tags.length > 0 ? `• [${item.tags.join(', ')}]` : '';
        const topSummary = item.topTitles && item.topTitles.length > 0 ? `추천작: ${item.topTitles.join(', ')}...` : '';

        card.innerHTML = `
            <div class="history-item-info">
                <div class="history-item-title-row">
                    <span class="history-target-title">${item.targetTitle}</span>
                    <span class="history-mode-badge">${modeText}</span>
                </div>
                <div class="history-meta-text">
                    <span>${item.timestamp}</span>
                    <span class="history-tags-text">${tagsSummary}</span>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
                    ${topSummary}
                </div>
            </div>
            <div>
                <button class="btn-action-recommend" style="padding: 6px 12px; font-size: 0.82rem;">
                    다시 보기 ➔
                </button>
            </div>
        `;

        card.addEventListener('click', () => {
            contentInput.value = item.targetTitle;
            currentFilterType = item.mode;
            selectTabButton(item.mode);
            applyModePreset(item.mode);

            selectedMoodTags.clear();
            if (item.tags) {
                item.tags.forEach(t => selectedMoodTags.add(t));
            }
            syncMoodTagChips();

            closeHistoryModal();
            handleRecommendation(true);
        });

        historyListContainer.appendChild(card);
    });
}

// ==========================================
// 15. [작품 상세 정보 모달 팝업] 열기 및 렌더링
// ==========================================
function openDetailModal(contentId) {
    const item = CONTENT_DATABASE.find(c => c.id === contentId);
    if (!item) return;

    incrementViewCount(contentId);
    const views = contentViewsMap[contentId] || 1;
    const isSaved = savedItemIds.has(contentId);
    const typeLabel = item.type === 'movie' ? '🎬 영화' : '📱 웹툰';

    detailModalHeaderTitle.innerHTML = `
        <span>${typeLabel}</span>
        <span style="font-weight: 800; color: #fff;">${item.title}</span>
    `;

    const moodTagsHtml = item.moodTags.map(tag => `<span class="tag-item matched">${tag}</span>`).join(' ');
    const genreTagsHtml = item.genres.map(genre => `<span class="tag-item">#${genre}</span>`).join(' ');
    const keywordTagsHtml = item.keywords.map(kw => `<span class="tag-item" style="background: rgba(255,184,0,0.12); color: #ffb800;">🔑 ${kw}</span>`).join(' ');

    detailModalBody.innerHTML = `
        <div class="detail-poster-col">
            <img src="${item.poster}" alt="${item.title}" class="detail-poster-img" />
            <div class="detail-poster-actions">
                <button class="btn-detail-recommend" id="btnDetailRecommend">
                    ⚡ 이 작품 기준으로 추천받기
                </button>
                <button class="btn-detail-save" id="btnDetailSave">
                    ${isSaved ? '★ 보관함에서 삭제' : '☆ 내 보관함에 저장'}
                </button>
                <button class="btn-detail-share" id="btnDetailShare">
                    🔗 이 작품 공유하기
                </button>
            </div>
        </div>
        
        <div class="detail-info-col">
            <div>
                <h2 class="detail-title">${item.title}</h2>
                <div class="detail-meta-row" style="margin-top: 0.5rem;">
                    <span style="color: #ff3366; font-weight: 700;">${item.category}</span>
                    <span>•</span>
                    <span>${item.releaseYear}년</span>
                    <span>•</span>
                    <span style="color: #ffb800; font-weight: 700;">★ 평점 ${item.rating}점</span>
                    <span>•</span>
                    <span style="color: #00dfd8; font-weight: 700;">누적 조회수 ${views}회</span>
                </div>
            </div>

            <div>
                <div class="detail-section-title">📝 전체 줄거리 상세</div>
                <p class="detail-summary-text">${item.summary}</p>
            </div>

            <div>
                <div class="detail-section-title">✨ 감성 및 분위기 태그</div>
                <div class="detail-tags-group">
                    ${moodTagsHtml}
                </div>
            </div>

            <div>
                <div class="detail-section-title">🏷️ 장르 분류</div>
                <div class="detail-tags-group">
                    ${genreTagsHtml}
                </div>
            </div>

            <div>
                <div class="detail-section-title">🔑 줄거리 핵심 키워드</div>
                <div class="detail-tags-group">
                    ${keywordTagsHtml}
                </div>
            </div>
        </div>
    `;

    // 상세 모달 내 '이 작품 기준으로 추천' 버튼
    document.getElementById('btnDetailRecommend').addEventListener('click', () => {
        contentInput.value = item.title;
        closeDetailModal();
        handleRecommendation(true);
    });

    // 상세 모달 내 '보관함 저장' 버튼
    const btnDetailSave = document.getElementById('btnDetailSave');
    btnDetailSave.addEventListener('click', () => {
        const cardBookmarks = document.querySelectorAll(`.btn-bookmark[data-id="${item.id}"]`);
        toggleSaveContent(item.id, null);
        
        const nowSaved = savedItemIds.has(item.id);
        btnDetailSave.textContent = nowSaved ? '★ 보관함에서 삭제' : '☆ 내 보관함에 저장';
        cardBookmarks.forEach(b => {
            if (nowSaved) {
                b.classList.add('saved');
                b.innerHTML = '★';
            } else {
                b.classList.remove('saved');
                b.innerHTML = '☆';
            }
        });
    });

    // 상세 모달 내 '이 작품 공유하기' 버튼
    document.getElementById('btnDetailShare').addEventListener('click', () => {
        const shareUrl = `${window.location.origin}${window.location.pathname}?target=${encodeURIComponent(item.title)}&mode=${item.type}`;
        copyToClipboard(shareUrl);
    });

    detailModalOverlay.style.display = 'flex';
}

function closeDetailModal() {
    detailModalOverlay.style.display = 'none';
}
