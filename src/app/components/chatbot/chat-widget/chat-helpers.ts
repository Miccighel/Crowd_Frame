export default class ChatHelper {
    // Controllo che un messaggio abbia valori compresi tra min e max e che sia un numero
    static validMsg(msg, min, max = null): boolean {
        if (max == null) {
            if (isNaN(+msg) || +msg % 1 != 0 || +msg < min) return false;
        } else if (isNaN(+msg) || +msg % 1 != 0 || +msg < min || +msg > max) {
            return false;
        }
        return true;
    }

    //Validazione dell'URL inserito
    static urlValid(msg): boolean {
        let pattern = new RegExp(
            "^(https?:\\/\\/)?" + // protocol
                "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" + // domain name
                "((\\d{1,3}\\.){3}\\d{1,3}))" + // OR ip (v4) address
                "(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" + // port and path
                "(\\?[;&a-z\\d%_.~+=-]*)?" + // query string
                "(\\#[-a-z\\d_]*)?$",
            "i"
        ); // fragment locator
        return !!pattern.test(msg);
    }
}
