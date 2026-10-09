// Build flags. EXPO_PUBLIC_* values are baked into the bundle when it is built, so a store
// build (eas.json "production" sets EXPO_PUBLIC_STORE=1) differs from the one the owner runs
// at home (start-windows.bat) and from the test builds (eas.json "preview").

/** The build that goes to the App Store and Google Play: no testing tools (test money, crowd test...). */
export const STORE_BUILD = process.env.EXPO_PUBLIC_STORE === '1';
