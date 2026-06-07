const STORAGE_KEY = 'home_page_filters';

export const saveHomePageFilters = ({ selectedLocation, isDuyTanGroupSelected }) => {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ selectedLocation, isDuyTanGroupSelected }),
    );
  } catch {
    /* ignore quota / private mode */
  }
};

export const loadHomePageFilters = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      selectedLocation: parsed.selectedLocation ?? null,
      isDuyTanGroupSelected: parsed.isDuyTanGroupSelected !== false,
    };
  } catch {
    return null;
  }
};

export const readInitialHomePageFilters = (searchParams) => {
  const fromUrl = {
    selectedLocation: searchParams.get('location') || null,
    isDuyTanGroupSelected: searchParams.get('group') !== 'other',
  };

  if (fromUrl.selectedLocation || searchParams.get('group')) {
    return fromUrl;
  }

  return loadHomePageFilters() ?? fromUrl;
};
