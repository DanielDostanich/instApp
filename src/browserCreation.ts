import puppeteer = require('puppeteer');
import puppeteerEx = require('puppeteer-extra');
import * as Proxy from './proxyTester';
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// @ts-ignore
puppeteerEx.use(StealthPlugin());
// @ts-ignore
puppeteerEx.use(require('puppeteer-extra-plugin-block-resources')({
    blockedTypes: new Set(['image', 'media', 'font'])
}))


export async function createBrowser(dirPath: string): Promise<puppeteer.Browser>{
    let args = [
        '--no-sandbox',
        '--lang=en-GB'
    ];

    if (Proxy.isProxy){
        args.push(`--proxy-server=${Proxy.proxyServer}`);
    }

    // @ts-ignore
    let browser = await puppeteerEx.launch({
        headless: false,
        userDataDir: dirPath,
        args: args,
    });

    if (Proxy.isProxy && Proxy.isAuth) {
        await Proxy.authenticate(browser);
    }
    return browser;
}
