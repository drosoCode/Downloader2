const myjd = require('jdownloader-api');

class MyJdownloader {
    constructor(user, password, host) {
        myjd.connect(user, password)
        this.host = host
    }

    addDownload(link, name=null) {
        myjd.addLinks(link, this.host, true);
    }
}

exports.MyJdownloader = MyJdownloader