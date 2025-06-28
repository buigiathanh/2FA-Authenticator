import { makeAutoObservable } from 'mobx';
import {extension} from "../utils/chrome";

class SettingStore {

    constructor() {
        makeAutoObservable(this);
    }

    popup = "";
    alert = {title: "", type: "", show: false};
}

export const settingStore = new SettingStore();
