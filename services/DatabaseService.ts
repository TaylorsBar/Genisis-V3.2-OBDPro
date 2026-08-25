import { get, set, del, keys } from 'idb-keyval';
import { LogSession, TuningProfile, DynoRun } from '../types';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';

/**
 * Robust Offline-First Database Service.
 * Leverages IndexedDB for zero-latency local caching and seamlessly synchronizes
 * with secure Firestore cloud persistence when the driver is authenticated.
 */
export class DatabaseService {

    // --- System Audit Logging (Comprehensive Logging Stack) ---
    public static async writeSystemLog(
        level: 'Info' | 'Warning' | 'Critical',
        category: string,
        message: string,
        details?: string
    ): Promise<void> {
        const id = 'sys_' + Math.random().toString(36).substring(2, 15);
        const log = {
            id,
            timestamp: Date.now(),
            level,
            category,
            message,
            details: details || ''
        };

        // Cache locally
        await set(`syslog_${id}`, log);

        // Write to Firestore if authenticated
        const user = auth.currentUser;
        if (user) {
            try {
                const path = `users/${user.uid}/systemLogs`;
                await setDoc(doc(db, path, id), log);
            } catch (error) {
                console.warn("[System Logging] Failed to sync log to Firestore:", error);
            }
        } else {
            console.log(`[System Log - ${category}] [${level}] ${message}`);
        }
    }

    public static async getAllSystemLogs(): Promise<any[]> {
        const allKeys = await keys();
        const syslogKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith('syslog_'));
        const localLogs: any[] = [];
        for (const key of syslogKeys) {
            const data = await get(key as string);
            if (data) localLogs.push(data);
        }

        const user = auth.currentUser;
        if (!user) return localLogs.sort((a, b) => b.timestamp - a.timestamp);

        try {
            const path = `users/${user.uid}/systemLogs`;
            const querySnapshot = await getDocs(collection(db, path));
            const remoteLogs: any[] = [];
            querySnapshot.forEach((doc) => {
                remoteLogs.push(doc.data());
            });

            // Merge and update local cache
            for (const log of remoteLogs) {
                await set(`syslog_${log.id}`, log);
            }
            return remoteLogs.sort((a, b) => b.timestamp - a.timestamp);
        } catch (error) {
            console.warn("Firestore SystemLogs fetch failed, falling back to local:", error);
            return localLogs.sort((a, b) => b.timestamp - a.timestamp);
        }
    }

    // --- Telemetry Data Logging ---
    public static async saveLog(log: LogSession): Promise<void> {
        // 1. Save to local IndexedDB
        await set(`log_${log.id}`, log);

        // 2. Sync to Firestore if authenticated
        const user = auth.currentUser;
        if (user) {
            const path = `users/${user.uid}/logs`;
            try {
                await setDoc(doc(db, path, log.id), log);
                await DatabaseService.writeSystemLog('Info', 'Database', `Synchronized telemetry log: ${log.name}`);
            } catch (error) {
                handleFirestoreError(error, OperationType.WRITE, `${path}/${log.id}`);
            }
        }
    }

    public static async getLog(id: string): Promise<LogSession | null> {
        // Try local cache first
        const local = await get(`log_${id}`);
        if (local) return local as LogSession;

        const user = auth.currentUser;
        if (user) {
            const path = `users/${user.uid}/logs`;
            try {
                // Return null if document doesn't exist, wrapped in try-catch
                const querySnapshot = await getDocs(collection(db, path));
                let found: LogSession | null = null;
                querySnapshot.forEach((doc) => {
                    if (doc.id === id) found = doc.data() as LogSession;
                });
                return found;
            } catch (error) {
                handleFirestoreError(error, OperationType.GET, `${path}/${id}`);
            }
        }
        return null;
    }

    public static async deleteLog(id: string): Promise<void> {
        await del(`log_${id}`);

        const user = auth.currentUser;
        if (user) {
            const path = `users/${user.uid}/logs`;
            try {
                await deleteDoc(doc(db, path, id));
                await DatabaseService.writeSystemLog('Info', 'Database', `Deleted telemetry log: ${id}`);
            } catch (error) {
                handleFirestoreError(error, OperationType.DELETE, `${path}/${id}`);
            }
        }
    }

    public static async getAllLogs(): Promise<LogSession[]> {
        const localLogs = await DatabaseService.getLocalLogs();
        const user = auth.currentUser;
        if (!user) return localLogs;

        try {
            const path = `users/${user.uid}/logs`;
            const querySnapshot = await getDocs(collection(db, path));
            const remoteLogs: LogSession[] = [];
            querySnapshot.forEach((doc) => {
                remoteLogs.push(doc.data() as LogSession);
            });

            // Update local cache
            for (const log of remoteLogs) {
                await set(`log_${log.id}`, log);
            }
            return remoteLogs.sort((a, b) => b.startTime - a.startTime);
        } catch (error) {
            console.warn("Firestore Logs fetch failed, falling back to local:", error);
            return localLogs;
        }
    }

    private static async getLocalLogs(): Promise<LogSession[]> {
        const allKeys = await keys();
        const logKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith('log_'));
        const logs: LogSession[] = [];
        for (const key of logKeys) {
            const data = await get(key as string);
            if (data) logs.push(data as LogSession);
        }
        return logs.sort((a, b) => b.startTime - a.startTime);
    }

    // --- Tuning Profiles ---
    public static async saveTuningProfile(profile: TuningProfile): Promise<void> {
        await set(`profile_${profile.id}`, profile);

        const user = auth.currentUser;
        if (user) {
            const path = `users/${user.uid}/profiles`;
            try {
                await setDoc(doc(db, path, profile.id), profile);
                await DatabaseService.writeSystemLog('Info', 'Tuning', `Synchronized custom map: ${profile.name}`);
            } catch (error) {
                handleFirestoreError(error, OperationType.WRITE, `${path}/${profile.id}`);
            }
        }
    }

    public static async getTuningProfile(id: string): Promise<TuningProfile | null> {
        const local = await get(`profile_${id}`);
        if (local) return local as TuningProfile;

        const user = auth.currentUser;
        if (user) {
            const path = `users/${user.uid}/profiles`;
            try {
                const querySnapshot = await getDocs(collection(db, path));
                let found: TuningProfile | null = null;
                querySnapshot.forEach((doc) => {
                    if (doc.id === id) found = doc.data() as TuningProfile;
                });
                return found;
            } catch (error) {
                handleFirestoreError(error, OperationType.GET, `${path}/${id}`);
            }
        }
        return null;
    }

    public static async deleteTuningProfile(id: string): Promise<void> {
        await del(`profile_${id}`);

        const user = auth.currentUser;
        if (user) {
            const path = `users/${user.uid}/profiles`;
            try {
                await deleteDoc(doc(db, path, id));
                await DatabaseService.writeSystemLog('Info', 'Tuning', `Deleted custom map: ${id}`);
            } catch (error) {
                handleFirestoreError(error, OperationType.DELETE, `${path}/${id}`);
            }
        }
    }

    public static async getAllTuningProfiles(): Promise<TuningProfile[]> {
        const localProfiles = await DatabaseService.getLocalTuningProfiles();
        const user = auth.currentUser;
        if (!user) return localProfiles;

        try {
            const path = `users/${user.uid}/profiles`;
            const querySnapshot = await getDocs(collection(db, path));
            const remoteProfiles: TuningProfile[] = [];
            querySnapshot.forEach((doc) => {
                remoteProfiles.push(doc.data() as TuningProfile);
            });

            for (const profile of remoteProfiles) {
                await set(`profile_${profile.id}`, profile);
            }
            return remoteProfiles.sort((a, b) => b.createdAt - a.createdAt);
        } catch (error) {
            console.warn("Firestore Profiles fetch failed, falling back to local:", error);
            return localProfiles;
        }
    }

    private static async getLocalTuningProfiles(): Promise<TuningProfile[]> {
        const allKeys = await keys();
        const profileKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith('profile_'));
        const profiles: TuningProfile[] = [];
        for (const key of profileKeys) {
            const data = await get(key as string);
            if (data) profiles.push(data as TuningProfile);
        }
        return profiles.sort((a, b) => b.createdAt - a.createdAt);
    }

    // --- Dyno Runs ---
    public static async saveDynoRun(run: DynoRun): Promise<void> {
        await set(`dyno_${run.id}`, run);

        const user = auth.currentUser;
        if (user) {
            const path = `users/${user.uid}/dynoRuns`;
            try {
                await setDoc(doc(db, path, run.id), run);
                await DatabaseService.writeSystemLog('Info', 'Database', `Synchronized dyno sweep: ${run.id}`);
            } catch (error) {
                handleFirestoreError(error, OperationType.WRITE, `${path}/${run.id}`);
            }
        }
    }

    public static async deleteDynoRun(id: string): Promise<void> {
        await del(`dyno_${id}`);

        const user = auth.currentUser;
        if (user) {
            const path = `users/${user.uid}/dynoRuns`;
            try {
                await deleteDoc(doc(db, path, id));
            } catch (error) {
                handleFirestoreError(error, OperationType.DELETE, `${path}/${id}`);
            }
        }
    }

    public static async getAllDynoRuns(): Promise<DynoRun[]> {
        const localRuns = await DatabaseService.getLocalDynoRuns();
        const user = auth.currentUser;
        if (!user) return localRuns;

        try {
            const path = `users/${user.uid}/dynoRuns`;
            const querySnapshot = await getDocs(collection(db, path));
            const remoteRuns: DynoRun[] = [];
            querySnapshot.forEach((doc) => {
                remoteRuns.push(doc.data() as DynoRun);
            });

            for (const run of remoteRuns) {
                await set(`dyno_${run.id}`, run);
            }
            return remoteRuns.sort((a, b) => b.timestamp - a.timestamp);
        } catch (error) {
            console.warn("Firestore DynoRuns fetch failed, falling back to local:", error);
            return localRuns;
        }
    }

    private static async getLocalDynoRuns(): Promise<DynoRun[]> {
        const allKeys = await keys();
        const dynoKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith('dyno_'));
        const runs: DynoRun[] = [];
        for (const key of dynoKeys) {
            const data = await get(key as string);
            if (data) runs.push(data as DynoRun);
        }
        return runs.sort((a, b) => b.timestamp - a.timestamp);
    }

    // --- Video / Binary Files ---
    public static async saveFileData(id: string, file: Blob): Promise<void> {
        await set(`file_${id}`, file);
    }

    public static async getFileData(id: string): Promise<Blob | null> {
        return (await get(`file_${id}`)) || null;
    }

    // --- Lap Sessions (Precision Lap Timing) ---
    public static async saveLapSession(session: any): Promise<void> {
        // 1. Save to local IndexedDB
        await set(`lapsession_${session.id}`, session);

        // 2. Sync to Firestore if authenticated
        const user = auth.currentUser;
        if (user) {
            const path = `users/${user.uid}/lapSessions`;
            try {
                await setDoc(doc(db, path, session.id), session);
                await DatabaseService.writeSystemLog('Info', 'Database', `Synchronized lap session: ${session.trackName || session.id}`);
            } catch (error) {
                handleFirestoreError(error, OperationType.WRITE, `${path}/${session.id}`);
            }
        }
    }

    public static async getAllLapSessions(): Promise<any[]> {
        const allKeys = await keys();
        const lapKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith('lapsession_'));
        const localSessions: any[] = [];
        for (const key of lapKeys) {
            const data = await get(key as string);
            if (data) localSessions.push(data);
        }

        const user = auth.currentUser;
        if (!user) return localSessions.sort((a, b) => b.timestamp - a.timestamp);

        try {
            const path = `users/${user.uid}/lapSessions`;
            const querySnapshot = await getDocs(collection(db, path));
            const remoteSessions: any[] = [];
            querySnapshot.forEach((doc) => {
                remoteSessions.push(doc.data());
            });

            // Merge and update local cache
            for (const s of remoteSessions) {
                await set(`lapsession_${s.id}`, s);
            }
            return remoteSessions.sort((a, b) => b.timestamp - a.timestamp);
        } catch (error) {
            console.warn("Firestore lapSessions fetch failed, falling back to local:", error);
            return localSessions.sort((a, b) => b.timestamp - a.timestamp);
        }
    }
}
