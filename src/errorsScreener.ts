import puppeteer = require('puppeteer');
import path = require('path');
import fs from "fs-extra";

(async () =>{
    await fs.mkdirp(path.resolve(__dirname, 'errors'));
})();

export async function screenError(name: string, page: puppeteer.Page){
    await page.screenshot({path: path.resolve(__dirname, `errors/${name}`, )});
}