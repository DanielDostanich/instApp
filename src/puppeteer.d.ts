declare module "puppeteer" {
    import {Serializable} from "puppeteer/lib/cjs/puppeteer/common/EvalTypes";

    interface Browser {
        newPage(): Promise<Page>;

        close(): Promise<any>
    }

    interface Page {
        goto(url: string): Promise<HTTPResponse>;

        screenshot(options: any): Promise<any>;

        waitForTimeout(milliseconds: number): Promise<any>;

        evaluate(func: any, ...args: any): Promise<Serializable>

        $(selector: string): Promise<any>;

        $$(selector: string): Promise<Array<any>>;

        $$eval(selector: string, pageFunction: Function, ...args: any): Promise<any>;

        addScriptTag(options: any): Promise<any>;

        type(selector: string, text: string): Promise<any>;

        click(selector: string): Promise<any>;

        waitForNavigation(options?: any): Promise<HTTPResponse>;

        waitForSelector(selector: string, options?: any): Promise<any>;
    }

    interface HTTPResponse {
    }

    function launch(obj: object): Promise<Browser>;
}