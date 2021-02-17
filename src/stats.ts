import puppeteer = require('puppeteer');
import path = require('path');

const fs = require('fs-extra');

const TIMEOUT: number = 5000;

export interface StatsRequest {
    inst_id: string;
    action: string; //Start | Stop
    timeout?: number;
}

export interface StatsResponse {
    status: boolean;
    inst_id: string;
    users?: Array<string>;
    errorMessage?: string;
}


export async function getFollowers(id: string): Promise<StatsResponse> {
    const isLogged: boolean = await fs.pathExists(path.resolve(__dirname, `cookies/${id}`));
    if (!isLogged) {
        return {
            status: false,
            inst_id: id,
            errorMessage: "User directory doesn't exist",
        }
    }
    const browser: puppeteer.Browser = await puppeteer.launch({
        headless: true,
        userDataDir: path.resolve(__dirname, path.resolve(__dirname, `cookies/${id}`)),
        args: [
            '--no-sandbox',
            '--lang=en-GB'
        ]
    });

    const page: puppeteer.Page = await browser.newPage();

    try {
        await page.goto('https://www.instagram.com/');
        await page.waitForTimeout(TIMEOUT);

        let responseObject: any = await page.evaluate(async () => {
            try {
                const response: Response = await fetch(`https://www.instagram.com/accounts/activity/?__a=1&include_reel=true`);
                return  response.json();
            } catch (e) {
                return null;
            }
        });

        if (responseObject === null) {
            return {
                status: false,
                inst_id: id,
                errorMessage: 'Error while fetching followers',
            }
        }

        let usersArray = responseObject.graphql.user.edge_follow_requests.edges;

        let IDs: Array<string> = [];

        for (let user of usersArray) {
            IDs.push(user.node.id);
        }

        return {
            status: true,
            inst_id: id,
            users: IDs,
        }

    } catch (e) {
        return {
            status: false,
            inst_id: id,
            errorMessage: e.message,
        }
    } finally {
        await browser.close();
    }
}

