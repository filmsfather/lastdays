import { toZonedTime, fromZonedTime, format } from 'date-fns-tz'

/**
 * 한국 시간대(KST) 기준 날짜/시간 처리 유틸리티
 * 모든 날짜 관련 처리를 Asia/Seoul 타임존으로 통일
 * date-fns-tz를 사용하여 정확한 시간대 처리
 */

const KOREA_TIMEZONE = 'Asia/Seoul'

/**
 * 현재 한국 시간을 Date 객체로 반환
 */
export const getKoreanDate = (): Date => {
  return toZonedTime(new Date(), KOREA_TIMEZONE)
}

/**
 * 현재 한국 날짜를 YYYY-MM-DD 형식 문자열로 반환
 * DB의 DATE 타입과 비교할 때 사용
 */
export const getKoreanDateString = (): string => {
  const koreanTime = toZonedTime(new Date(), KOREA_TIMEZONE)
  return format(koreanTime, 'yyyy-MM-dd')
}

/**
 * 한국 시간 기준으로 특정 날짜를 YYYY-MM-DD 형식으로 변환
 */
export const toKoreanDateString = (date: Date): string => {
  const koreanTime = toZonedTime(date, KOREA_TIMEZONE)
  return format(koreanTime, 'yyyy-MM-dd')
}

/**
 * ISO 문자열을 한국 시간대 기준 날짜로 포맷팅
 * DB의 TIMESTAMP WITH TIME ZONE 표시용
 */
export const formatKoreanDate = (timestamp: string): string => {
  const koreanTime = toZonedTime(new Date(timestamp), KOREA_TIMEZONE)
  return format(koreanTime, 'yyyy년 MM월 dd일')
}

/**
 * ISO 문자열을 한국 시간대 기준 날짜/시간으로 포맷팅
 */
export const formatKoreanDateTime = (timestamp: string): string => {
  const koreanTime = toZonedTime(new Date(timestamp), KOREA_TIMEZONE)
  return format(koreanTime, 'yyyy년 MM월 dd일 HH:mm')
}

/**
 * 시간만 표시 (HH:MM 형식)
 */
export const formatKoreanTime = (timestamp: string): string => {
  const koreanTime = toZonedTime(new Date(timestamp), KOREA_TIMEZONE)
  return format(koreanTime, 'HH:mm')
}

/**
 * HTML input[type="date"]용 최소값 (오늘 이후만 선택 가능)
 */
export const getMinDateForInput = (): string => {
  return getKoreanDateString()
}

/**
 * 두 날짜가 같은 날인지 한국 시간대 기준으로 비교
 */
export const isSameKoreanDate = (date1: Date | string, date2: Date | string): boolean => {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2
  
  return toKoreanDateString(d1) === toKoreanDateString(d2)
}

/**
 * 한국 시간대 기준으로 날짜 차이 계산 (일 단위)
 */
export const getDaysDifference = (date1: Date | string, date2: Date | string): number => {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2
  
  const koreanDate1 = toZonedTime(d1, KOREA_TIMEZONE)
  const koreanDate2 = toZonedTime(d2, KOREA_TIMEZONE)
  
  // 시간 부분을 제거하고 날짜만 비교
  const date1Only = new Date(koreanDate1.getFullYear(), koreanDate1.getMonth(), koreanDate1.getDate())
  const date2Only = new Date(koreanDate2.getFullYear(), koreanDate2.getMonth(), koreanDate2.getDate())
  
  const timeDiff = date2Only.getTime() - date1Only.getTime()
  return Math.floor(timeDiff / (1000 * 60 * 60 * 24))
}