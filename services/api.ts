import axios, { AxiosError } from 'axios';
import { destroyCookie, parseCookies, setCookie } from 'nookies'; 
import Router from 'next/router'

let cookies = parseCookies();
let isRefreshing = false;
let failedRequestQueue = [];


export const api = axios.create({
    baseURL: 'http://localhost:3002',
    headers: {
        Authorization: `Bearer ${cookies['nextauth.token']}`
    }
});

export function signOut () {
    destroyCookie(undefined, 'nextauth.token')
    destroyCookie(undefined, 'nextauth.refreshToken')  

    Router.push('/')
}

api.interceptors.response.use(response => {
    return response;
}, (error: AxiosError) => {
    
    if (error.response.status === 401) {
        
        if (error.response.data?.code == 'token.expired') {
            cookies = parseCookies();

            const { 'nextauth.refreshToken': refreshToken } = cookies;
            const originalConfig = error.config;

            if (!isRefreshing) {
                isRefreshing = true;

                api.post('/refresh', {
                    refreshToken,
                }).then(response =>{
                    const { token } = response.data;
    
                    setCookie(undefined, 'nextauth.token', token, {
                        maxAge: 60 * 60 * 30,  
                        path: '/'
                    })
                    
                    setCookie(undefined, 'nextauth.refreshToken', response.data.refreshToken, {
                        maxAge: 60 * 60 * 30,  
                        path: '/'
                    })
    
                    api.defaults.headers['Authorization'] = `Bearer ${token}`;

                    failedRequestQueue.forEach(request => request.onSuccess(token))
                    failedRequestQueue = [];
                }).catch((err) => {
                    failedRequestQueue.forEach(request => request.onFailure(err))
                    failedRequestQueue = [];

                }).finally(() => {
                    isRefreshing = false
                });
            }

            return new Promise((resolve, reject) => {
                failedRequestQueue.push({
                    onSuccess: (token: string) => {
                        originalConfig.headers['Authorization'] = `Bearer ${token}`;
                        
                        resolve(api(originalConfig))
                    },
                    onFailure: (err: AxiosError) => {
                        reject(err)
                    }
                })
            })
        } else {
           signOut()
        }
    }

    return Promise.reject(error)
});