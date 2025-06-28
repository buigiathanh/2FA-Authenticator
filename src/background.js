/*global chrome*/
import {extension} from "./utils/chrome";

chrome.runtime.onInstalled.addListener(async function (details) {
    if (details.reason === "install") {
        //todo
    }
});

chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true}).catch((error) => console.error(error));

chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.setOptions({
        tabId: tab.id,
        path: "pages/side_panel.html",
        enabled: true
    });
    chrome.sidePanel.open({tabId: tab.id});
});

chrome.runtime.onMessageExternal.addListener(function (request, sender, sendResponse) {
    return handleSendMessage(request, sender, sendResponse)
})

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    return handleSendMessage(request, sender, sendResponse)
})

const handleSendMessage = (req, sender, res) => {
    switch (req.action) {
        case "capture":
            chrome.tabs.captureVisibleTab(req.data.tab.windowId, (screenshot) => {
                res({status: true, data: {image: screenshot}})
            });
            return true;

        case "get_data_storage":
            handleGetDataInStorage(req, res)
            return true;

        case "set_data_storage":
            handleSetDataToStorage(req, res)
            return true;

        case "get_extension_version":
            res({status: true, data: {version: extension.getManifest().version}})
            return true;

        case "google_analytics":
            sendGoogleAnalytics(req.data, res);
            return true;

        default:
            res({status: true});
            break;
    }
}

const handleGetDataInStorage = async (req, res) => {
    const data = await extension.storage.getItem(req.data.key);
    res({status: true, data})
}

const handleSetDataToStorage = async (req, res) => {
    await extension.storage.setItem(req.data.key, req.data.value);
    res({status: true})
}

const sendGoogleAnalytics = async (data, callback) => {
    const { en, ep = [], tid, cid, v, t, ul, sr } = data;

    const raw = [
        `en=${en}`,
        ...ep.map(item => `ep.${item.key}=${item.value}`)
    ].join('&');

    const params = {
        tid: String(tid),
        cid: String(cid),
        seg: "1",
        ...(v && { v: String(v) }),
        ...(t && { t: String(t) }),
        ...(ul && { ul: String(ul) }),
        ...(sr && { sr: String(sr) }),
    };

    const url = "https://www.google-analytics.com/g/collect?" + new URLSearchParams(params);

    await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: raw,
        redirect: "follow",
    });

    callback({ status: true });
};
