import puppeteer = require('puppeteer');
import path = require('path');
import fs from "fs-extra";

import {Mutex} from "async-mutex";

let mutexes: Map<string, Mutex> = new Map();
// Mutexes are not removed after deleting user dir.

(async () => {
    await fs.mkdirp(path.resolve(__dirname, 'errors'));
    const cookies = await fs.opendir(path.resolve(__dirname, `cookies`));
    for await (const userIdDir of cookies) {
        mutexes.set(userIdDir.name, new Mutex());
    }
})();

export async function screenError(name: string, page: puppeteer.Page) {
    await page.screenshot({path: path.resolve(__dirname, `errors/${name}`,)});
}

export async function acquireMutex(id: string) {
    if (mutexes.has(id)) {
        let mutex: Mutex = mutexes.get(id) as Mutex;
        await mutex.acquire();
    } else {
        throw new Error(`There's no such mutex in acquire: ${id}`);
    }
}

export function releaseMutex(id: string) {
    if (mutexes.has(id)){
        let mutex: Mutex = mutexes.get(id) as Mutex;
        mutex.release();
    } else {
        throw new Error(`There's no such mutex in release: ${id}`);
    }
}

export async function copyUserDirIntoCookiesDir(dirNumber: number, id: string) {
    let dirMutex: Mutex;
    if (mutexes.has(id)){
        dirMutex = mutexes.get(id) as Mutex;
    } else {
        dirMutex = new Mutex();
        mutexes.set(id, dirMutex);
    }
    await dirMutex.acquire();
    await fs.copy(path.resolve(__dirname, `loginDirs/userDir${dirNumber}`), path.resolve(__dirname, `cookies/${id}`));
    dirMutex.release();
}

export async function isUserLoggedInBot(id: string): Promise<boolean> {
    let dirMutex: Mutex;
    if (mutexes.has(id)){
        dirMutex = mutexes.get(id) as Mutex;
    } else {
        dirMutex = new Mutex();
        mutexes.set(id, dirMutex);
    }
    await dirMutex.acquire();
    try {
        await fs.access(path.resolve(__dirname, `cookies/${id}`));
        return true;
    } catch {
        return false;
    } finally {
        dirMutex.release();
    }
}


