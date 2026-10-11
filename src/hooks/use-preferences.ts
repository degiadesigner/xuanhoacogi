import {useEffect,useState} from 'react';
import {emptyProfile,validateProfile,type PoolProfile} from '@/lib/personal-pool';
import {readCookie,writeCookie,clearCookie} from '@/lib/cookies';
function load(){try{return validateProfile(readCookie('pool'))}catch{return emptyProfile()}}
export function usePreferences(){
 const [profile,setProfile]=useState<PoolProfile>(emptyProfile),[error,setError]=useState('');
 useEffect(()=>{setProfile(load())},[]);
 const save=(next:PoolProfile)=>{try{const checked=validateProfile(next);writeCookie('pool',checked);setProfile(checked);setError('');return true}catch(e){setError((e as Error).message);return false}};
 const reload=()=>{const next=load();setProfile(next);setError('');return next};
 const remove=()=>{try{clearCookie('pool');setProfile(emptyProfile());setError('');return true}catch(e){setError((e as Error).message);return false}};
 return {profile,error,setError,save,reload,remove};
}
export type Preferences=ReturnType<typeof usePreferences>;
