fetch("http://127.0.0.1:61001/guest/verify-code", {
    "headers": {
        "Content-Type": "application/json",
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJWQlMtQ29tbXVuaXR5IiwiaWF0IjoxNzcyMzczNjU0LCJleHAiOjE3NzIzNzM5NTQsImlwIjoiMTI3LjAuMC4xIiwidHlwZSI6Imd1ZXN0IiwianRpIjoiN1FkZjRJMk1oalRVWExVbElWMlJKejRhMCtXTk9EU0R3M2RUYjFhK01NOD0ifQ.qM-oa3uGgkqEUPxrRXtLjxfdnDOnAUmgB2cBmX05ntY"
    }
}).then((response) => response.text()).then(console.log);