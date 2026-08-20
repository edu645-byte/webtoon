/**
 * [오늘 뭐 볼까?] - 추천 알고리즘 엔진 (recommender.js)
 * 
 * 1. 자카드 유사도(Jaccard Similarity) 기반 점수 계산
 * 2. 장르(35%) + 분위기 태그(40%) + 키워드(25%) 가중치 종합 점수 산출 (0~100점)
 * 3. 사용자 선택 태그 기준 단독 매칭
 * 4. '웹툰만 추천', '영화만 추천', '전체 추천' 모드별 최적화된 결과(최대 20편) 반환
 */

// =========================================================================
// 1. 자카드 유사도(Jaccard Similarity) 계산 함수
// =========================================================================
function calculateJaccard(arr1, arr2) {
    if (!arr1 || !arr2 || arr1.length === 0 || arr2.length === 0) {
        return 0;
    }
    
    // 교집합: 두 배열에 모두 포함된 요소
    const intersection = arr1.filter(item => arr2.includes(item));
    // 합집합: 두 배열의 모든 고유 요소
    const union = Array.from(new Set([...arr1, ...arr2]));
    
    if (union.length === 0) return 0;
    return intersection.length / union.length;
}

// 두 배열의 공통 원소 추출 함수
function getIntersection(arr1, arr2) {
    if (!arr1 || !arr2) return [];
    return arr1.filter(item => arr2.includes(item));
}

// =========================================================================
// 2. 종합 유사도 점수 계산 및 추천 엔진 (웹툰 전용 / 영화 전용 / 전체 지원)
// =========================================================================
function getRecommendations(targetQuery, filterType = 'all', userSelectedMoods = [], limitPerCategory = 20) {
    // 1) 입력된 검색어로 기준 작품 찾기 (ID 또는 제목 완전/부분 일치)
    const normalizedQuery = targetQuery.trim().toLowerCase();
    
    const targetContent = CONTENT_DATABASE.find(item => 
        item.id.toLowerCase() === normalizedQuery ||
        item.title.toLowerCase() === normalizedQuery ||
        item.title.toLowerCase().includes(normalizedQuery)
    );

    if (!targetContent) {
        return {
            success: false,
            message: `"${targetQuery}" 작품을 데이터베이스에서 찾을 수 없습니다. 아래 추천 키워드 버튼을 클릭해 보세요!`
        };
    }

    // 2) 비교 대상 태그 결정 (사용자가 태그를 선택했으면 해당 태그들을 최우선 비교)
    const isUserMoodSelected = (userSelectedMoods && userSelectedMoods.length > 0);
    const compareMoods = isUserMoodSelected ? userSelectedMoods : targetContent.moodTags;

    // 3) 기준 작품을 제외한 후보군 전체에 대해 점수 계산
    const scoredList = CONTENT_DATABASE
        .filter(item => item.id !== targetContent.id)
        .map(item => {
            // 자카드 유사도 계산
            const genreSim = calculateJaccard(targetContent.genres, item.genres);
            const moodSim = calculateJaccard(compareMoods, item.moodTags);
            const keywordSim = calculateJaccard(targetContent.keywords, item.keywords);

            // 공통 원소 추출
            const commonGenres = getIntersection(targetContent.genres, item.genres);
            const commonMoods = getIntersection(compareMoods, item.moodTags);
            const commonKeywords = getIntersection(targetContent.keywords, item.keywords);

            // 종합 점수 계산 (가중치: 분위기 40%, 장르 35%, 키워드 25%)
            let weightedScore = (moodSim * 0.40) + (genreSim * 0.35) + (keywordSim * 0.25);
            let finalScore = Math.round(weightedScore * 100);

            // 사용자 선택 태그 보너스 점수
            if (isUserMoodSelected && commonMoods.length > 0) {
                const matchRatio = commonMoods.length / userSelectedMoods.length;
                finalScore += Math.round(matchRatio * 25);
            }

            // 공통 요소가 존재할 경우 기본 친밀도 보정
            if (commonMoods.length > 0 || commonGenres.length > 0) {
                finalScore += (commonMoods.length * 15) + (commonGenres.length * 8) + (commonKeywords.length * 5);
            }

            // 점수 범위 0 ~ 100점으로 정규화
            finalScore = Math.min(100, Math.max(0, finalScore));

            // 추천 사유 문구 동적 생성
            let matchReason = "";
            if (isUserMoodSelected && commonMoods.length > 0) {
                matchReason = `선택하신 [${commonMoods.join(', ')}] 태그 완벽 일치 및 장르 유사!`;
            } else if (commonMoods.length > 0 && commonGenres.length > 0) {
                matchReason = `${commonMoods.slice(0, 2).join(', ')} 감성 & ${commonGenres.slice(0, 2).join(', ')} 장르 매칭!`;
            } else if (commonMoods.length > 0) {
                matchReason = `비슷한 감성 및 분위기 (${commonMoods.slice(0, 2).join(', ')}) 매칭!`;
            } else if (commonGenres.length > 0) {
                matchReason = `동일한 주요 장르 (${commonGenres.slice(0, 2).join(', ')}) 매칭!`;
            } else {
                matchReason = `스토리 키워드 및 대중 평점(${item.rating}점) 기반 추천!`;
            }

            return {
                ...item,
                similarity: finalScore,
                commonGenres,
                commonMoods,
                commonKeywords,
                matchReason
            };
        });

    // 4) 영화 목록과 웹툰 목록을 각각 유사도 및 평점 순으로 정렬
    const movieCandidates = scoredList
        .filter(item => item.type === 'movie')
        .sort((a, b) => b.similarity - a.similarity || b.rating - a.rating);

    const webtoonCandidates = scoredList
        .filter(item => item.type === 'webtoon')
        .sort((a, b) => b.similarity - a.similarity || b.rating - a.rating);

    // 5) 선택된 모드(웹툰만 / 영화만 / 전체)에 따라 풍성한 결과 반환
    let moviesResult = [];
    let webtoonsResult = [];

    if (filterType === 'all') {
        // 전체 모드: 영화 상위 10편 + 웹툰 상위 10편 (총 20편)
        moviesResult = movieCandidates.slice(0, 10);
        webtoonsResult = webtoonCandidates.slice(0, 10);
    } else if (filterType === 'movie') {
        // 영화만 보기 모드: 영화 상위 20편 집중 추천
        moviesResult = movieCandidates.slice(0, limitPerCategory);
        webtoonsResult = [];
    } else if (filterType === 'webtoon') {
        // 웹툰만 보기 모드: 웹툰 상위 20편 집중 추천
        moviesResult = [];
        webtoonsResult = webtoonCandidates.slice(0, limitPerCategory);
    }

    return {
        success: true,
        targetContent,
        filterType,
        movies: moviesResult,
        webtoons: webtoonsResult,
        totalCount: moviesResult.length + webtoonsResult.length
    };
}
