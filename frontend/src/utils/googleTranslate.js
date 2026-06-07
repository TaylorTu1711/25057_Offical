const GOOGTRANS_COOKIE = 'googtrans';
const PAGE_LANGUAGE = 'vi';

function getCookieDomains() {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (isLocalhost) return [''];

  return ['', hostname, `.${hostname}`];
}

function buildCookieParts(domain) {
  const secure = window.location.protocol === 'https:' ? ';Secure' : '';
  const domainPart = domain ? `;domain=${domain}` : '';
  return { secure, domainPart };
}

/** Xóa cookie googtrans trên mọi biến thể domain (cần cho HTTPS production). */
export function clearGoogTransCookie() {
  const expired = 'Thu, 01 Jan 1970 00:00:00 GMT';

  getCookieDomains().forEach((domain) => {
    const { secure, domainPart } = buildCookieParts(domain);
    document.cookie = `${GOOGTRANS_COOKIE}=;expires=${expired};path=/${domainPart}${secure}`;
  });
}

/** Đặt cookie dịch từ tiếng Việt (pageLanguage) sang ngôn ngữ đích. */
export function setGoogTransCookie(targetLang) {
  clearGoogTransCookie();

  const value = `/${PAGE_LANGUAGE}/${targetLang}`;
  const { secure } = buildCookieParts('');

  getCookieDomains().forEach((domain) => {
    const { domainPart } = buildCookieParts(domain);
    document.cookie = `${GOOGTRANS_COOKIE}=${value};path=/${domainPart}${secure}`;
  });
}

export function getGoogTransTargetLang() {
  const googtransCookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${GOOGTRANS_COOKIE}=`));

  if (!googtransCookie) return null;

  const cookieValue = decodeURIComponent(googtransCookie.split('=').slice(1).join('=') || '');
  if (!cookieValue || cookieValue === '/auto/vi' || cookieValue.endsWith('/vi')) return null;
  if (cookieValue.endsWith('/en')) return 'en';
  return null;
}

export function applyGoogleTranslation(targetLang) {
  if (targetLang === PAGE_LANGUAGE) return false;

  const combo = document.querySelector('.goog-te-combo');
  if (!combo) return false;

  combo.value = targetLang;
  combo.dispatchEvent(new Event('change'));
  return true;
}
