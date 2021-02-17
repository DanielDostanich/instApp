import puppeteer = require('puppeteer');
import path = require('path');
import {Mutex} from "async-mutex";

import fs from "fs-extra";

import {screenError} from './errorsScreener';

export interface LoginRequest {
    type: string; // Login | DoubleAuth
    username: string;
    body: string;
}

export interface LoginResponse {
    status: boolean;
    username: string;
    is_private?: boolean;
    inst_id?: string;
    is_double_auth?: boolean;
    error_message?: string;
}

interface UserIdAndPrivacy {
    inst_id: string;
    is_private: boolean;
}


export interface BrowserData {
    browser: puppeteer.Browser;
    page: puppeteer.Page;
    dirNumber: number;
}


let dirNumberMutex = new Mutex();
let dirCounter: number = 0;

export class Login {
    private readonly browser: puppeteer.Browser;
    private readonly page: puppeteer.Page;
    private readonly dirNumber: number;
    private instId: string | null = null;

    //A constructor cannot be async so I created async function for getting browser data
    public static async getBrowserAndPage(): Promise<BrowserData> {
        await dirNumberMutex.acquire();
        let dirNumber = dirCounter++;
        dirNumberMutex.release();
        let browser = await puppeteer.launch({
            headless: false,
            userDataDir: path.resolve(__dirname, `loginDirs/userDir${dirNumber}`),
            args: [
                '--no-sandbox',
                '--lang=en-GB'
            ]
        });
        let page = await browser.newPage();
        return {
            browser: browser,
            page: page,
            dirNumber: dirNumber,
        };
    }

    constructor(browserData: BrowserData) {
        this.browser = browserData.browser;
        this.page = browserData.page;
        this.dirNumber = browserData.dirNumber;
    }


    public async login(username: string, password: string): Promise<LoginResponse> {
        let inst_id: string | null = null;
        let is_double: boolean = false;
        try {
            let is_private: boolean;
            ({inst_id, is_private, is_double} = await this.LoginAndGetUserData(username, password));
            // destructuring assignment doesn't allow "this."
            this.instId = inst_id;
            return {
                status: true,
                username: username,
                inst_id: this.instId,
                is_double_auth: is_double,
                is_private: is_private,
            }
        } catch (e) {
            await screenError(`${this.dirNumber}-login.png`, this.page);
            return {
                status: false,
                username: username,
                error_message: `${e.message}, Check ${this.dirNumber}-login.png`,
            }
        } finally {
            if (!is_double) {
                await this.browser.close();
                if (this.instId != null) {
                    await this.copyUserFolderIntoCookiesDir(this.instId);
                }
                await this.removeUserDirFolder();
            }
        }
    }
    // I need username only for creating response object. Maybe I should get rid of this.
    public async doubleAuth(username: string, code: string): Promise<LoginResponse> {
        try {
            await this.page.type('[name=verificationCode]', code);

            await this.page.addScriptTag({path: require.resolve('jquery')});
            await this.page.evaluate(() => {
                $('button:contains("Confirm")').addClass('followerGettingApp');
                $('button:contains("Подтвердить")').addClass('followerGettingApp');
            });
            await this.page.click('.followerGettingApp');

            await this.page.waitForSelector('[href="/"]');
            await this.browser.close();
            await this.copyUserFolderIntoCookiesDir(this.instId as string);
            return {
                status: true,
                username: username,
            }
        } catch (e) {
            await screenError(`${this.dirNumber}-doubleAuth.png`, this.page);
            await this.browser.close();
            return {
                status: false,
                username: username,
                error_message: e.message + 'Check ${this.dirNumber}-doubleAuth.png',
            }
        }
        finally {
            await this.removeUserDirFolder();
        }
    }

    private async copyUserFolderIntoCookiesDir(id: string) {
        await fs.copy(path.resolve(__dirname, `loginDirs/userDir${this.dirNumber}`), path.resolve(__dirname, `cookies/${id}`));
    }

    private async removeUserDirFolder() {
        await fs.remove(path.resolve(__dirname, `loginDirs/userDir${this.dirNumber}`));
    }

    private async LoginAndGetUserData(username: string, password: string) {
        await this.page.goto('https://www.instagram.com/accounts/login/');

        await this.fillInputsAndSubmit(username, password);

        let userIdAndPrivacy = await this.getIdAndPrivacy(username);

        return {
            inst_id: userIdAndPrivacy.inst_id,
            is_private: userIdAndPrivacy.is_private,
            is_double: await this.isDoubleAuth(),
        }

    }

    private async isDoubleAuth() {
        return await this.page.$('#verificationCodeDescription') != null;
    }


    private async fillInputsAndSubmit(username: string, password: string) {
        await this.page.waitForSelector('[name=username]');
        await this.page.type('[name=username]', username);
        await this.page.type('[name=password]', password);
        await this.page.click('[type=submit]');
        await this.page.waitForTimeout(7000);
        if (await this.page.$('[role="alert"]') != null) {
            await screenError(`${this.dirNumber}-alert.png`, this.page);
            throw new Error(`Instagram exception: probably wrong password. Check ${this.dirNumber}-alert.png`);
        }
    }

    private async getIdAndPrivacy(username: string): Promise<UserIdAndPrivacy> {
        let responseObject: any = await this.page.evaluate(async (username: string) => {
            try {
                const response = await fetch(`https://www.instagram.com/${username}/?__a=1`);
                return response.json();
            } catch (e) {
                return null;
            }
        }, username);
        if (responseObject === null) {
            throw new Error('Error while fetching id');
        }
        return {
            inst_id: responseObject.graphql.user.id,
            is_private: responseObject.graphql.user.is_private,
        };
    }
}

