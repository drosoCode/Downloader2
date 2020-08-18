const axios = require('axios');

class Discord {
    constructor(user, password=null, host=null) {
        this.webhook = user
    }

    notify(title, content) {
        axios.post(this.webhook, {content: title+ ': ' + message}).catch(() => {console.log('Discord Communication Error')})
    }
}

exports.Discord = Discord