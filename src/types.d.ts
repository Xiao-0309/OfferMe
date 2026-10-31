import type { OfferMeApi } from '../electron/preload';
import type { OfferMeSetupApi } from '../electron/setupPreload';

declare global {
  interface Window {
    offerme: OfferMeApi;
    /** setup window only (src/setup.html + electron/setupPreload.ts) */
    offermeSetup: OfferMeSetupApi;
    /** E2E hook: main calls this (with user gesture) when OFFERME_AUTOSTART=1 */
    __offermeAutoStart?: () => void;
    /** visual-QA hooks: main calls these when OFFERME_MAIN_SHOT=<dir> */
    __offermeOpenSettings?: () => void;
    __offermeOpenHelp?: () => void;
  }
}

export {};
