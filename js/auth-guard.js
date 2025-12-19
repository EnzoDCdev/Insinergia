(function () {
    function ensureAuthenticated() {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');

        if (!token || !userStr) {
            window.location.href = 'index.html';
            return null;
        }

        let user;
        try {
            user = JSON.parse(userStr);
        } catch (e) {
            localStorage.clear();
            window.location.href = 'index.html';
            return null;
        }

        return { token, user };
    }

    window.InsinergiaAuth = { ensureAuthenticated };
})();