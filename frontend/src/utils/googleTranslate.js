const GOOGTRANS_COOKIE = 'googtrans';
const APP_LANG_KEY = 'app_lang';
const PAGE_LANGUAGE = 'vi';

function getCookieDomains() {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (isLocalhost) return [''];

  const domains = new Set(['', hostname, `.${hostname}`]);
  const parts = hostname.split('.');

  if (parts.length > 2) {
    domains.add(`.${parts.slice(-2).join('.')}`);
  }

  return [...domains];
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
    document.cookie = `${GOOGTRANS_COOKIE}=;max-age=0;path=/${domainPart}${secure}`;
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

export function getSavedAppLanguage() {
  const savedLang = localStorage.getItem(APP_LANG_KEY);
  if (savedLang === 'vi' || savedLang === 'en') return savedLang;
  return getGoogTransTargetLang() || PAGE_LANGUAGE;
}

export function shouldLoadGoogleTranslate() {
  return getSavedAppLanguage() === 'en';
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

/** Gỡ class/dấu vết Google Translate khi về tiếng Việt gốc. */
export function resetGoogleTranslateArtifacts() {
  clearGoogTransCookie();

  document.documentElement.classList.remove('translated-ltr', 'translated-rtl');
  document.documentElement.removeAttribute('lang');

  if (document.body) {
    document.body.classList.remove('translated-ltr', 'translated-rtl');
    document.body.style.top = '0';
  }

  document.querySelectorAll('font[style*="vertical-align"]').forEach((node) => {
    const parent = node.parentNode;
    if (!parent) return;
    while (node.firstChild) {
      parent.insertBefore(node.firstChild, node);
    }
    parent.removeChild(node);
  });
}

export function loadGoogleTranslateScript() {
  if (window.__googleTranslateScriptLoading || window.google?.translate?.TranslateElement) {
    return;
  }

  window.__googleTranslateScriptLoading = true;

  window.googleTranslateElementInit = () => {
    new window.google.translate.TranslateElement(
      {
        pageLanguage: PAGE_LANGUAGE,
        includedLanguages: 'vi,en',
        autoDisplay: false,
      },
      'google_translate_element',
    );
  };

  const script = document.createElement('script');
  script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  script.async = true;
  document.head.appendChild(script);
}

export function applyGoogleTranslation(targetLang) {
  if (targetLang === PAGE_LANGUAGE) return false;

  const combo = document.querySelector('.goog-te-combo');
  if (!combo) return false;

  combo.value = targetLang;
  combo.dispatchEvent(new Event('change'));
  return true;
}
