import {useEffect, useState} from "react";
import {icons} from "../../../../constants/icon";

function FaviconImage({url}) {
    const [favicon, setFavicon] = useState(icons.favicon);

    const getFavicon = async (url) => {
        if (url.startsWith("chrome://") || url.startsWith("https://chromewebstore.google.com/")) {
            return icons.favicon;
        } else {
            const linkFavicon = `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${url}&size=32`;
            const check = await fetch(linkFavicon, {
                method: "HEAD",
                cache: "no-store"
            });
            if (check.status === 404) {
                return icons.favicon;
            } else {
                return linkFavicon
            }
        }
    }

    useEffect(() => {
        (async () => {
            const urlFavicon = await getFavicon(url);
            setFavicon(urlFavicon)
        })()
    }, [url]);

    return (
        <>
            {
                favicon.length > 0 && (
                    <img
                        src={favicon}
                        alt="favicon"
                        className={`w-4 h-4`}
                    />
                )
            }
        </>
    );
}

export default FaviconImage