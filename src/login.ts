import puppeteer = require('puppeteer');
import path = require('path');
import {Mutex} from "async-mutex";
import {createBrowser} from "./browserCreation";
import fs from "fs-extra";
const fetchNode = require('node-fetch');
import * as File from './file';

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

        let browser: puppeteer.Browser = await createBrowser(path.resolve(__dirname, `loginDirs/userDir${dirNumber}`));

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
        let is_double: boolean = false;
        let wasError: boolean = false;
        try {
            await this.page.goto('https://www.instagram.com/accounts/login/');

            await this.clickAcceptCookies();
            let userIdAndPrivacy = await Login.getIdAndPrivacy(username);

            this.instId = userIdAndPrivacy.inst_id;
            if (await File.isUserLoggedInBot(this.instId)) {
                wasError = true;
                return {
                    status: false,
                    username: username,
                    error_message: `User with this inst_id already exist: inst_id: ${this.instId}`,
                }
            }

            await this.fillInputsAndSubmit(username, password);

            is_double = await this.isDoubleAuth();

            if (!is_double && !(await this.isUserLoggedInInst())) {
                await File.screenError(`${this.dirNumber}-afterLogin.png`, this.page);
                wasError = true;
                return {
                    status: false,
                    username: username,
                    error_message: `User wasn't logged in: ${username}, ${this.instId}. Check ${this.dirNumber}-afterLogin.png`,
                }
            }

            await this.finishLogin();
            await this.page.waitForTimeout(2000);

            return {
                status: true,
                username: username,
                inst_id: this.instId,
                is_double_auth: is_double,
                is_private: userIdAndPrivacy.is_private,
            }
        } catch (e) {
            wasError = true;
            await File.screenError(`${this.dirNumber}-login.png`, this.page);
            return {
                status: false,
                username: username,
                error_message: `${e.message}, Check ${this.dirNumber}-login.png`,
            }
        } finally {

            let correctFinishing: boolean = !is_double && !wasError;
            let justFinishing: boolean = !is_double || wasError;

            if (correctFinishing) {
                await this.finishLogin();
            }
            if (justFinishing) {
                await this.browser.close();
            }
            if (correctFinishing) {
                await File.copyUserDirIntoCookiesDir(this.dirNumber, this.instId as string);
            }
            if (justFinishing) {
                await this.removeUserDir();
            }
        }
    }

    private async clickAcceptCookies(): Promise<void>{
        await this.page.addScriptTag({path: require.resolve('jquery')});
        await this.page.evaluate(() => {
            $('button:contains("Accept")').addClass('cookiesAcceptInst');
            $('button:contains("Принять")').addClass('cookiesAcceptInst');
        });
        if (await this.page.$('.cookiesAcceptInst') != null) {
            await this.page.click('.cookiesAcceptInst');
        }
        await this.page.waitForTimeout(2000);
    }

    private async isUserLoggedInInst(): Promise<boolean> {
        try {
            let response: boolean = await this.page.evaluate(async () => {
                return (await fetch(`https://www.instagram.com/accounts/activity/?__a=1`)).redirected;
            });
            return !response;
        } catch {
            return false;
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
            await this.page.waitForTimeout(8000);
            if (!(await this.isUserLoggedInInst())) {
                await File.screenError(`${this.dirNumber}-afterLogin.png`, this.page);
                await this.browser.close();
                return {
                    status: false,
                    username: username,
                    error_message: `User wasn't logged in: ${username}, ${this.instId}. Check ${this.dirNumber}-afterLogin.png`,
                }
            }
            await this.finishLogin();
            await this.page.waitForTimeout(3000);
            await this.browser.close();
            await File.copyUserDirIntoCookiesDir(this.dirNumber, this.instId as string);
            return {
                status: true,
                username: username,
            }
        } catch (e) {
            await File.screenError(`${this.dirNumber}-doubleAuth.png`, this.page);
            await this.browser.close();
            return {
                status: false,
                username: username,
                error_message: e.message + `Check ${this.dirNumber}-doubleAuth.png`,
            }
        } finally {
            await this.removeUserDir();
        }
    }


    private async removeUserDir() {
        await fs.remove(path.resolve(__dirname, `loginDirs/userDir${this.dirNumber}`));
    }

    private async isDoubleAuth() {
        return await this.page.$('#verificationCodeDescription') != null;
    }


    private async finishLogin() {
        await this.page.addScriptTag({path: require.resolve('jquery')});
        await this.page.evaluate(() => {
            $('button:contains("Save Info")').addClass('saveInfoButton');
            //$('button:contains("Подтвердить")').addClass('followerGettingApp');
        });
        if (await this.page.$('.saveInfoButton') != null) {
            await this.page.click('.saveInfoButton');
        }
    }


    private async fillInputsAndSubmit(username: string, password: string) {
        await this.page.waitForSelector('[name=username]');
        await this.page.type('[name=username]', username);
        await this.page.type('[name=password]', password);
        await this.page.click('[type=submit]');
        await this.page.waitForTimeout(7000);
        if ((await this.page.$$('button[disabled=""]')).length != 0) {
            throw new Error(`Instagram exception: button is inactive`);
        }
        if (await this.page.$('[role="alert"]') != null) {
            throw new Error(`Instagram exception: probably wrong password`);
        }
    }

    private static async getIdAndPrivacy(username: string): Promise<UserIdAndPrivacy> {

        let responseJSON = await (await fetchNode(`https://www.instagram.com/${username}/?__a=1`)).json();

        if (responseJSON === null) {
            throw new Error('Error while fetching id');
        }
        return {
            inst_id: responseJSON.graphql.user.id,
            is_private: responseJSON.graphql.user.is_private,
        };
    }
}

