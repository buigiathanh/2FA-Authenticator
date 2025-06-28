import { makeAutoObservable } from 'mobx';
import {extension} from "../utils/chrome";
import QRCode from "qrcode";
import {settingStore} from "./setting.store";

class SecretKeyStore {

    constructor() {
        makeAutoObservable(this);
    }

    secret_keys = [];
    link_qr_code = "";

    async setSecretKey(value) {
        const updatedKeys = [...this.secret_keys, value];
        this.secret_keys = updatedKeys;
        await extension.storage.setItem("list_secret_key_2fa", JSON.stringify(updatedKeys))
    }

    async getSecretKey() {
        const listSecretKeys = await extension.storage.getItem('list_secret_key_2fa');
        if (typeof listSecretKeys === "string") {
            this.secret_keys = JSON.parse(listSecretKeys)
        } else {
            this.secret_keys = [];
        }
    }

    async deleteSecretKey(key) {
        const dataSecretKeys = this.secret_keys.filter(item => item.secretKey !== key);
        this.secret_keys = dataSecretKeys;
        await extension.storage.setItem("list_secret_key_2fa", JSON.stringify(dataSecretKeys));
        settingStore.alert = {title: extension.getLang("message_delete_success"), type: "success", show: true}
    }

    async getLinkQRCode(key) {
        try {
            const website = key.website;
            const issuer = key?.issuer ? key?.issuer : website.replaceAll("https://", "").replaceAll("http://", "")
            const qrData = `otpauth://totp/${encodeURIComponent(`${issuer}:${key.account}`)}?secret=${encodeURIComponent(key.secretKey)}&issuer=${issuer}`;
            this.link_qr_code = await QRCode.toDataURL(qrData);
            settingStore.popup = "qr_code";
        } catch (error) {
            settingStore.alert = {title: extension.getLang("message_create_qr_error"), type: "error", show: true}
        }
    }
}

export const secretKeyStore = new SecretKeyStore();
