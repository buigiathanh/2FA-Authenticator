import {extension} from "../../../../../utils/chrome";
import {settingStore} from "../../../../../mobx/setting.store";
import {useClickOutside} from "../../../../../hooks/useClickOutside";
import {useCallback, useEffect, useRef, useState} from "react";
import {secretKeyStore} from "../../../../../mobx/secret_key.store";
import {observer} from "mobx-react-lite";
import {googleAnalytics} from "../../../../../utils/google_analytics";

const PopupCreateSecretKey = () => {
    const ref = useRef(null);
    const isShow = settingStore.popup;
    const [isLoading, setIsLoading] = useState(false);
    const dataFormDefault = {website: '', account: '', secret: '', errors: {}}
    const [formState, setFormState] = useState(dataFormDefault);

    const saveSecretKey = useCallback(async () => {
        const {website, account, secret} = formState;
        if (!website || !account || !secret) {
            setFormState(prev => ({
                ...prev,
                errors: {
                    website: website ? '' : extension.getLang("message_website_empty"),
                    account: account ? '' : extension.getLang("message_account_empty"),
                    secret: secret ? '' : extension.getLang("message_secret_key_empty"),
                },
            }));
            return;
        }

        try {
            setIsLoading(true);
            await secretKeyStore.setSecretKey({
                website: new URL(website).origin,
                issuer: new URL(website).origin.replaceAll("https://", "").replaceAll("http://", ""),
                account,
                secretKey: secret
            })
            setFormState(dataFormDefault);
            settingStore.popup = "";
            settingStore.alert = {
                title: extension.getLang("message_add_success"),
                type: "success",
                show: true
            }
        } catch (error) {
            settingStore.alert = {
                title: extension.getLang("message_add_error"),
                type: "error",
                show: true
            }
        }

        setIsLoading(false);
    }, [formState]);


    useClickOutside(ref, () => {
        settingStore.popup = ""
    });

    useEffect(() => {
        isShow && googleAnalytics({name: "show_popup_create"}).then()
    }, [isShow])

    return (
        <>
            {
                settingStore.popup === "create_secret_key" && (
                    <>
                        <div className="w-full h-[100vh] fixed top-0 left-0 bg-black/70" style={{zIndex: 100}}/>
                        <div ref={ref} className="w-full fixed bottom-0 left-0 p-[10px]"
                             style={{zIndex: 101}}>
                            <div className="w-full bg-white rounded-lg p-5">
                                <p className="font-bold text-[14px] mb-2">
                                    {extension.getLang("title_create")}
                                </p>
                                <p className="text-[12px] mb-5">
                                    {extension.getLang("description_title_create")}
                                </p>

                                <div className="w-full mb-5">
                                    <label
                                        htmlFor="secret"
                                        className="block mb-2 text-[12px] font-medium text-gray-900"
                                    >
                                        {extension.getLang("label_secret_key")} <span className={`text-red-500`}>*</span>
                                    </label>
                                    <input
                                        value={formState.secret}
                                        onChange={(e) =>
                                            setFormState((prev) => ({
                                                ...prev,
                                                secret: e.target.value,
                                                errors: {...prev.errors, secret: ''},
                                            }))
                                        }
                                        type="text"
                                        id="secret"
                                        placeholder="BK5V TVQ7 D2RB..."
                                        className={`bg-gray-50 border ${formState.errors.secret ? "border-red-500" : "border-gray-300"} text-gray-900 text-[12px] rounded-lg block w-full p-2.5 mb-1`}
                                    />
                                    {formState.errors.secret && (
                                        <p className="text-red-500">
                                            {formState.errors.secret}
                                        </p>
                                    )}
                                </div>
                                <div className="w-full mb-5">
                                    <label
                                        htmlFor="website"
                                        className="block mb-2 text-[12px] font-medium text-gray-900"
                                    >
                                        {extension.getLang("label_website")} <span
                                        className={`text-red-500`}>*</span>
                                    </label>
                                    <input
                                        value={formState.website}
                                        onChange={(e) =>
                                            setFormState((prev) => ({
                                                ...prev,
                                                website: e.target.value,
                                                errors: {...prev.errors, website: ''},
                                            }))
                                        }
                                        type="text"
                                        id="website"
                                        placeholder="https://example.com"
                                        className={`bg-gray-50 border ${formState.errors.website ? "border-red-500" : "border-gray-300"} text-gray-900 text-[12px] rounded-lg block w-full p-2.5 mb-1`}
                                    />
                                    {formState.errors.website &&
                                        <p className="text-red-500">
                                            {formState.errors.website}
                                        </p>
                                    }
                                </div>
                                <div className="w-full mb-5">
                                    <label
                                        htmlFor="account"
                                        className="block mb-2 text-[12px] font-medium text-gray-900"
                                    >
                                        {extension.getLang("label_account")} <span className={`text-red-500`}>*</span>
                                    </label>
                                    <input
                                        value={formState.account}
                                        onChange={(e) =>
                                            setFormState((prev) => ({
                                                ...prev,
                                                account: e.target.value,
                                                errors: {...prev.errors, account: ''},
                                            }))
                                        }
                                        type="text"
                                        id="account"
                                        placeholder="example"
                                        className={`bg-gray-50 border ${formState.errors.account ? "border-red-500" : "border-gray-300"} text-gray-900 text-[12px] rounded-lg block w-full p-2.5 mb-1`}
                                    />
                                    {formState.errors.account &&
                                        <p className="text-red-500">{formState.errors.account}</p>}
                                </div>
                                <div className="w-full flex justify-between">
                                    <div className="inline-block w-[59%]">
                                        <button
                                            onClick={saveSecretKey}
                                            className="h-[40px] w-full rounded-[10px] bg-blue-500 text-white px-5 disabled:opacity-50"
                                            disabled={isLoading}
                                        >
                                            {isLoading ? extension.getLang("button_create_running") : extension.getLang("button_create")}
                                        </button>
                                    </div>
                                    <div className="inline-block w-[39%]">
                                        <button
                                            onClick={() => {
                                                settingStore.popup = "";
                                                setFormState(dataFormDefault)
                                            }}
                                            className="h-[40px] w-full rounded-[10px] bg-gray-200 text-gray-900 px-5"
                                            disabled={isLoading}
                                        >
                                            {extension.getLang("button_cancel")}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )
            }
        </>
    )
}

export default observer(PopupCreateSecretKey)