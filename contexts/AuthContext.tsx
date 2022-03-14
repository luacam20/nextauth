import { createContext, ReactNode, useEffect, useState } from "react";
import { api, signOut } from "../services/api";
import { setCookie, parseCookies, destroyCookie } from 'nookies';
import Router from 'next/router'

interface User {
    email: string;
    permissions: string[];
    roles: string[];
}

interface SignInCredentials {
  email: string;
  password: string;  
}

interface AuthContextData {
    signIn(credentials: SignInCredentials): Promise<void>;
    user: User;
    isAuthenticated: boolean;
}

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthContext = createContext({} as AuthContextData);

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User>();
    const isAuthenticated = !!user; 
    
    useEffect(() => {
        const {'nextauth.token': token } = parseCookies() //dando um novo nome

        if (token) {
            api.get('/me').then(response => {
                const { email, permissions, roles } = response.data;

                setUser({ email, permissions, roles });
            })
            .catch(error => {
                signOut()
            })
        }
    }, [])
    
    async function signIn({ email, password }: SignInCredentials) {
        try {
            const response = await api.post('sessions', {
                email,
                password
            })
            
            const { token, refreshToken, permissions, roles } = response.data;

            setCookie(undefined, 'nextauth.token', token, {
                maxAge: 60 * 60 * 30, //Cookie salvo 1 mes 
                path: '/' //Qualquer endereço vai ter acessp aos Cookie
            })
            
            setCookie(undefined, 'nextauth.refreshToken', refreshToken, {
                maxAge: 60 * 60 * 30, //Cookie salvo 1 mes 
                path: '/' //Qualquer endereço vai ter acessp aos Cookie
            })

            setUser({
                email,
                permissions,
                roles
            })
            
            api.defaults.headers['Authorization'] = `Bearer ${token}`

            Router.push('/dashboard');
        
        } catch (err) {
            console.log(err)
        }
    }

    return (
        <AuthContext.Provider value={{ signIn, isAuthenticated, user }}>
            {children}
        </AuthContext.Provider>
    )
}