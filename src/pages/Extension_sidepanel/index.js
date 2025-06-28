/*global chrome*/
import {useEffect, useState, useCallback} from 'react';
import {CountdownCircleTimer} from 'react-countdown-circle-timer';
import {extension} from '../../utils/chrome';
import PopupQRCode from "./components/popups/qr_code";
import PopupCreateSecretKey from "./components/popups/create_secret_key";
import {secretKeyStore} from "../../mobx/secret_key.store";
import IconQRCode from "../../components/icons/qr";
import IconPlus from "../../components/icons/plus";
import AlertComponent from "../../components/alert";
import {settingStore} from "../../mobx/setting.store";
import {getCode2FA, getTimeOTP} from "../../utils/secret_key";
import IconSearch from "../../components/icons/search";
import IconDelete from "../../components/icons/delete";
import {observer} from "mobx-react-lite";
import {image} from "../../utils/images";
import IconUser from "../../components/icons/user";
import IconSetting from "../../components/icons/setting";
import IconExport from "../../components/icons/export";
import IconImport from "../../components/icons/import";
import IconAngleDown from "../../components/icons/angle_down";
import FaviconImage from "./components/favicon";
import {googleAnalytics} from "../../utils/google_analytics";

const ExtensionSidePanel = () => {
    const secretKeys = secretKeyStore.secret_keys;
    const [groupSecretKeys, setGroupSecretKeys] = useState([]);
    const [countdown, setCountdown] = useState(getTimeOTP());
    const [code, setCode] = useState('');
    const [keySearch, setKeySearch] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleGetCode2FA = useCallback(async () => {
        if (code.length > 0) {
            try {
                const otp = getCode2FA(code);
                await navigator.clipboard.writeText(otp);
                settingStore.alert = {title: extension.getLang("message_get_code_success"), type: "success", show: true}
            } catch (e) {
                settingStore.alert = {title: extension.getLang("message_get_code_error"), type: "error", show: true}
            }
        }
    }, [code]);


    const handleCopy = useCallback(async (code) => {
        try {
            const otp = getCode2FA(code);
            await navigator.clipboard.writeText(otp);
            googleAnalytics({name: "copy_2fa"}).then()
            settingStore.alert = {title: extension.getLang("message_copy_success"), type: "success", show: true}
        } catch (error) {
            console.log("error", error)
            settingStore.alert = {title: extension.getLang("message_copy_error"), type: "success", show: true}
        }
    }, []);


    const scanQR = useCallback(async () => {
        try {
            setIsLoading(true);
            const tabs = await chrome.tabs.query({active: true, lastFocusedWindow: true});
            googleAnalytics({name: "scan_qr_code"}).then()
            await chrome.tabs.sendMessage(tabs[0].id, {action: 'captureSelection', data: {tab: tabs[0]}});
        } catch (error) {
            settingStore.alert = {title: extension.getLang("message_scan_qr_error"), type: "error", show: true}
        } finally {
            setIsLoading(false);
        }
    }, []);


    const handleGetTime = useCallback(() => {
        const options = window.otplib.authenticator.allOptions();
        return options.step - (new Date(options.epoch).getSeconds() % options.step);
    }, []);


    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter') {
            handleGetCode2FA().then();
            googleAnalytics({name: "get_2fa"}).then()
        }
    }, [handleGetCode2FA]);

    const handleClickIconTitle = (icon, id) => {
        const elIcon = document.getElementById(icon);
        const el = document.getElementById(id);
        const isVisibilityHidden = window.getComputedStyle(el).display === "none"
        if (isVisibilityHidden) {
            el.style.display = "block";
            elIcon.style.transform = 'rotate(0deg)';
        } else {
            el.style.display = "none";
            elIcon.style.transform = 'rotate(180deg)';
        }
    }


    useEffect(() => {
        const intervalId = setInterval(() => {
            setCountdown(prev => (prev <= 1 ? handleGetTime() : prev - 1));
        }, 1000);
        return () => clearInterval(intervalId);
    }, [handleGetTime]);

    useEffect(() => {
        if (secretKeys.length > 0) {
            let secretKeyGroups = [];
            let dataSecretKeys = secretKeys;
            if (keySearch.length > 0) {
                dataSecretKeys = secretKeys.filter((item => item.account.toLowerCase().includes(keySearch.toLowerCase()) || item.website.toLowerCase().includes(keySearch.toLowerCase())))
            }
            for (let i = 0; i < dataSecretKeys.length; i++) {
                const indexGroup = secretKeyGroups.findIndex(item => item.website === dataSecretKeys[i].website);
                let dataKey = {
                    account: dataSecretKeys[i].account,
                    key: dataSecretKeys[i].secretKey,
                }
                if (indexGroup === -1) {
                    secretKeyGroups.push({
                        website: dataSecretKeys[i].website,
                        secret_keys: [dataKey]
                    })
                } else {
                    secretKeyGroups[indexGroup].secret_keys = secretKeyGroups[indexGroup].secret_keys.concat([dataKey])
                }
            }

            setGroupSecretKeys(JSON.parse(JSON.stringify(secretKeyGroups)))
        }
    }, [secretKeys, keySearch]);

    useEffect(() => {
        secretKeyStore.getSecretKey().then();

        chrome.storage.onChanged.addListener((changes, area) => {
            for (let key in changes) {
                switch (key) {
                    case "list_secret_key_2fa":
                        secretKeyStore.getSecretKey().then();
                        break;
                }
            }
        });

        googleAnalytics({name: "use_extension"}).then()
    }, [])


    return (
        <div className="w-full h-[100vh] bg-[#282828] box-border">
            <div className="w-full m-auto bg-[#282828] flex justify-center">
                <div className="h-[100vh] w-full inline-block box-border overflow-y-auto">
                    <div className="w-full relative p-[20px] overflow-y-auto" style={{height: 'calc(100vh - 60px)'}}>
                        <div className="w-full mb-[20px]">
                            <h5 className="font-bold text-white text-[16px] mb-[5px]">
                                {extension.getLang("title")}
                            </h5>
                            <p className="text-white text-[12px] mb-[5px]">
                                {extension.getLang("description_title")}
                            </p>
                        </div>

                        <div className="w-full">
                            <div className="w-full flex justify-between mb-[10px] p-[10px] bg-[#3C3C3C] rounded-[10px]">
                                <div className="inline-block" style={{width: 'calc(100% - 50px)'}}>
                                    <input
                                        value={code}
                                        onChange={(e) => setCode(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder={extension.getLang("placeholder_input")}
                                        className="w-full h-[40px] bg-[#3C3C3C] px-3 border-none outline-none text-white"
                                        disabled={isLoading}
                                    />
                                </div>
                                <div className="inline-block pl-3">
                                    <button
                                        onClick={handleGetCode2FA}
                                        type="button"
                                        className="px-3 h-10 text-xs font-medium text-center text-white rounded-lg focus:outline-none bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? extension.getLang("button_get_running") : extension.getLang("button_get")}
                                    </button>
                                </div>
                            </div>
                            <div
                                className="w-full h-[40px] rounded-[10px] bg-[#3C3C3C] p-[10px] flex justify-between mb-5">
                                <div className="inline-block" style={{width: 'calc(100% - 40px)'}}>
                                    <input
                                        onChange={(e) => setKeySearch(e.target.value)}
                                        value={keySearch}
                                        placeholder={extension.getLang("placeholder_search")}
                                        className="w-full h-[20px] bg-[#3C3C3C] border-none outline-none text-white"
                                        disabled={isLoading}
                                    />
                                </div>
                                <div className="inline-block w-[20px]">
                                    <IconSearch cname={"w-[20px] h-[20px] text-white cursor-pointer"}/>
                                </div>
                            </div>

                            {
                                groupSecretKeys.length > 0 && (
                                    <>
                                        {
                                            groupSecretKeys.map((item, key) => (
                                                <div
                                                    key={key}
                                                    className={`w-full mb-2 border border-[#3C3C3C] p-3 rounded-lg cursor-pointer hover:bg-[#171717]`}
                                                >
                                                    <div onClick={() => handleClickIconTitle(btoa(`icon_${item.website}`), btoa(`2fa_${item.website}`))} className={`w-full flex items-center`}>
                                                        <div className={`inline-block w-6 h-6 bg-[#3C3C3C] p-1 rounded`}>
                                                            <FaviconImage url={item.website}/>
                                                        </div>
                                                        <div
                                                            className={`inline-block pl-2`}
                                                            style={{width: "calc(100% - 50px)"}}
                                                        >
                                                            <p className={`text-white text-sm font-bold w-full truncate`}>
                                                                <span>{item.website}</span>
                                                            </p>
                                                        </div>
                                                        <div
                                                            id={btoa(`icon_${item.website}`)}
                                                            className={`w-4 inline-block cursor-pointer transition-transform duration-300 ease-in-out rotate-180`}
                                                        >
                                                            <IconAngleDown cname={"w-4 h-4 text-white"}/>
                                                        </div>
                                                    </div>
                                                    <div id={btoa(`2fa_${item.website}`)} className={"mt-3"}
                                                         style={{display: "none"}}>
                                                        {
                                                            item.secret_keys.map((secretKey, index) => (
                                                                <div
                                                                    key={index}
                                                                    className="w-full group rounded-[10px] mb-[10px] last:mb-0 bg-[#3C3C3C] px-[15px] py-[10px] flex justify-between items-center"
                                                                >
                                                                    <div className="inline-block w-[40px]">
                                                                        <CountdownCircleTimer
                                                                            isPlaying
                                                                            duration={30}
                                                                            size={40}
                                                                            strokeWidth={3}
                                                                            trailColor="#282828"
                                                                            initialRemainingTime={countdown}
                                                                            onComplete={() => ({
                                                                                shouldRepeat: true,
                                                                                newInitialRemainingTime: handleGetTime()
                                                                            })}
                                                                            colors={countdown > 10 ? '#fff' : '#fca5a5'}
                                                                        >
                                                                            {({remainingTime}) => (
                                                                                <span
                                                                                    className={countdown > 10 ? 'text-white' : 'text-red-300'}>
                                                                                {remainingTime}
                                                                            </span>
                                                                            )}
                                                                        </CountdownCircleTimer>
                                                                    </div>
                                                                    <div className="inline-block pl-5 relative"
                                                                         style={{width: 'calc(100% - 40px)'}}>
                                                                        <p className="w-full text-white mb-[5px] text-[12px] truncate">
                                                                            {secretKey.account}
                                                                        </p>
                                                                        <h4
                                                                            onClick={() => handleCopy(secretKey.key)}
                                                                            className={`${countdown > 10 ? 'text-white' : 'text-red-300'} text-[18px] font-bold cursor-pointer`}
                                                                        >
                                                                            {getCode2FA(secretKey.key)}
                                                                        </h4>
                                                                        <div className="absolute flex bottom-0 right-0">
                                                                            <div
                                                                                onClick={() => secretKeyStore.getLinkQRCode({
                                                                                    website: item.website,
                                                                                    account: secretKey.account,
                                                                                    secretKey: secretKey.key
                                                                                })}
                                                                                className="hidden group-hover:inline-block cursor-pointer w-6 h-6 p-1 me-1 last:me-0 rounded hover:bg-gray-500"
                                                                            >
                                                                                <IconQRCode cname={"w-4 h-4 text-white"}/>
                                                                            </div>
                                                                            <div
                                                                                onClick={() => secretKeyStore.deleteSecretKey(secretKey.key)}
                                                                                className="hidden group-hover:inline-block cursor-pointer w-6 h-6 p-1 me-1 last:me-0 rounded hover:bg-gray-500"
                                                                            >
                                                                                <IconDelete cname={"w-4 h-4 text-white"}/>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        }
                                                    </div>
                                                </div>
                                            ))
                                        }
                                    </>
                                )
                            }
                        </div>

                        <div className={`w-full fixed bottom-[10px] right-0 flex justify-end`}>
                            <div className="inline-block me-1 hidden">
                                <div
                                    className="w-[40px] h-[40px] rounded-[5px] bg-[#3C3C3C] cursor-pointer flex items-center border border-[#282828]">
                                    <IconExport cname={"w-6 h-6 text-white m-auto inline-block"}/>
                                </div>
                            </div>

                            <div className="inline-block me-1 hidden">
                                <div
                                    className="w-[40px] h-[40px] rounded-[5px] bg-[#3C3C3C] cursor-pointer flex items-center border border-[#282828]">
                                    <IconImport cname={"w-6 h-6 text-white m-auto inline-block"}/>
                                </div>
                            </div>

                            <div onClick={scanQR} className="inline-block me-1">
                                <div
                                    className="w-[40px] h-[40px] rounded-[5px] bg-[#3C3C3C] cursor-pointer flex items-center border border-[#282828]">
                                    <IconQRCode cname={"w-6 h-6 text-white m-auto inline-block"}/>
                                </div>
                            </div>

                            <div
                                onClick={() => settingStore.popup = "create_secret_key"}
                                className="inline-block me-1"
                            >
                                <div
                                    className="w-[40px] h-[40px] rounded-[5px] bg-[#3C3C3C] cursor-pointer flex items-center border border-[#282828]">
                                    <IconPlus cname={"w-6 h-6 text-white m-auto inline-block"}/>
                                </div>
                            </div>

                            <div className="inline-block me-1 hidden">
                                <div
                                    className="w-[40px] h-[40px] rounded-[5px] bg-[#3C3C3C] cursor-pointer flex items-center border border-[#282828]">
                                    <IconSetting cname={"w-6 h-6 text-white m-auto inline-block"}/>
                                </div>
                            </div>

                            <div className="inline-block me-1 hidden">
                                <div
                                    className="w-[40px] h-[40px] rounded-[5px] bg-[#3C3C3C] cursor-pointer flex items-center border border-[#282828]">
                                    <IconUser cname={"w-6 h-6 text-white m-auto inline-block"}/>
                                </div>
                            </div>
                        </div>

                        <PopupQRCode/>

                        <PopupCreateSecretKey/>

                        <AlertComponent/>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default observer(ExtensionSidePanel);