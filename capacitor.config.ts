import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor 설정
 *
 * 이 파일은 웹앱을 네이티브 Android APK로 래핑하기 위한 설정입니다.
 *
 * webDir: Vite 빌드 출력 디렉토리 (dist/)
 * appId: Google Play Store에 등록할 패키지 ID
 * appName: 사용자에게 표시되는 앱 이름
 *
 * 보안 설정:
 * - allowNavigation: 외부 URL 접근을 차단합니다 (오프라인 전용)
 * - server.cleartext: false로 설정하여 HTTP 트래픽을 차단합니다
 */
const config: CapacitorConfig = {
  appId: 'com.ahagoitda.mugong',
  appName: '무공키우기',
  webDir: 'dist',
  server: {
    // 오프라인 전용이므로 외부 서버 연결 없음
    cleartext: false,
  },
  android: {
    // 전체 화면 모드 (상태바 숨김)
    backgroundColor: '#1a1a2e',
  },
  plugins: {
    // 향후 플러그인 추가 시 여기에 설정
  },
};

export default config;
