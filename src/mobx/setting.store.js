import { makeAutoObservable } from 'mobx';
import {extension} from "../utils/chrome";

class SettingStore {

    constructor() {
        makeAutoObservable(this);
    }

    theme = "dark_mode"
    popup = "";
    alert = {title: "", type: "", show: false};

    async getTheme() {
        const dataTheme = await extension.storage.getItem("theme_select");
        this.theme = dataTheme ? dataTheme : "dark_mode";
    }

    async setTheme(value) {
        this.theme = value;
        await extension.storage.setItem("theme_select", value)
    }
}

export const settingStore = new SettingStore();
