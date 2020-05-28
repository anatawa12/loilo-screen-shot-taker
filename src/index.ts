#!/usr/bin/env node
import * as commandLineArgs from 'command-line-args';
import * as commandLineUsage from 'command-line-usage';
import * as puppeteer from "puppeteer";
import {Page} from "puppeteer";
import * as fs from "fs";
import * as dateformat from "dateformat";
import parseDuration from "parse-duration";

interface MainConfig {
    school: string;
    user: string;
    pass: string;
    class: number;
    note: number;
    interval: number;
    debug: boolean;
    ifSharing: boolean;
}

const paramDef = [
    {
        name: 'school',
        alias: 's',
        description: 'school id',
        type: String,
        require: true,
    },
    {
        name: 'user',
        alias: 'u',
        description: 'user id',
        type: String,
        require: true,
    },
    {
        name: 'pass',
        alias: 'p',
        description: 'your password',
        type: String,
        require: true,
    },
    {
        name: 'class',
        alias: 'c',
        description: 'class id (https://loilonote.app/_/<here is the class id>)',
        type: Number,
        require: true,
    },
    {
        name: 'note',
        alias: 'n',
        description: 'note id (https://loilonote.app/_/<here is the class id>/<here is the note id>)',
        type: Number,
        require: true,
    },
    {
        name: 'interval',
        alias: 'i',
        description: 'interval time to take shots. you can use syntax by https://www.npmjs.com/package/parse-duration. defaults 1000ms',
        type: parseDuration,
        require: false,
        defaultValue: 1000
    },
    {
        name: 'if-sharing',
        description: 'take shots if screen was shard from teacher',
        type: Boolean,
    },
    {
        name: 'debug',
        description: 'enable debug mode',
        type: Boolean,
    },
];

const usage = [
    {
        header: 'Say Hello Command',
        content: 'loilo-screen-shot-taker -s <school-id> -u <user-id> -p <password> -c <class-id> -n <note-id>',
    },
    {
        header: 'Parameters',
        hide: ['command'],
        optionList: paramDef
    }
];

async function exec(): Promise<number> {
    const cfg = commandLineArgs(paramDef, { camelCase: true }) as MainConfig;

    // Valid require params
    const requiresNotSetted = paramDef
        .filter(x => x.require)
        .filter(x => cfg[x.name] == null)
        .map(x => `--${x.name}`);

    if (requiresNotSetted.length > 0) {
        console.log(`Param: ${requiresNotSetted.join(' ')} is required.`);
        console.log(`------------------------------------`);
        const usg = commandLineUsage(usage)
        console.log(usg);
        return -1;
    }

    return run(cfg);
}

async function run(cfg: MainConfig): Promise<number> {

    const browser = await puppeteer.launch({
        headless: !cfg.debug,
    });
    const page = await browser.newPage();
    await page.setUserAgent((await browser.userAgent()).replace("HeadlessChrome", "Chrome"));
    await page.goto("https://loilonote.app/login", {waitUntil: ["load", "networkidle2"]});
    await page.setViewport({
        width: 1024,
        height: 768
    })


    if (page.url() == "https://loilonote.app/login") {
        await take(page, cfg)
        await loginLoilo(page, cfg)
    }

    await take(page, cfg)

    await page.goto(`https://loilonote.app/_/${cfg.class}/${cfg.note}`);

    if (page.url().startsWith("https://loilonote.app/login")) {
        throw Error("can't login with the uid")
    }

    while (true) {
        await take(page, cfg)
        await new Promise(resolve => setTimeout(resolve, cfg.interval))
    }

    return 0;
}

async function take(page: Page, cfg: MainConfig) {
    if (cfg.ifSharing && await page.$('.screenSharing') == null)
        return
    if (!fs.existsSync("out"))
        fs.mkdirSync("out")
    const data = await page.screenshot();
    fs.writeFileSync(`out/${process.pid}_${dateformat(new Date, "yyyy-mm-dd-HH-MM-ss-l")}.png`, data)
}

async function loginLoilo(page: Page, cfg: MainConfig) {
    await page.type("#login-form input[name=\"school_code\"]", cfg.school)
    await page.type("#login-form input[name=\"user\"]", cfg.user)
    await page.type("#login-form input[name=\"password\"]", cfg.pass)
    await page.click("#submit-button")
}


exec()
    .then(exit => process.exit(exit))
    .catch(e => {
        console.log(e)
        process.exit(1);
    })
