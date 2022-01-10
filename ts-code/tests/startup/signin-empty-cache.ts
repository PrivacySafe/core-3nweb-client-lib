/*
 Copyright (C) 2016 - 2018, 2020 3NSoft Inc.
 
 This program is free software: you can redistribute it and/or modify it under
 the terms of the GNU General Public License as published by the Free Software
 Foundation, either version 3 of the License, or (at your option) any later
 version.
 
 This program is distributed in the hope that it will be useful, but
 WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 See the GNU General Public License for more details.
 
 You should have received a copy of the GNU General Public License along with
 this program. If not, see <http://www.gnu.org/licenses/>.
*/

import { itCond, beforeAllWithTimeoutLog, afterAllCond } from '../libs-for-tests/jasmine-utils';
import { setupWithUsers } from '../libs-for-tests/setups';
import { checkKeyDerivNotifications } from '../libs-for-tests/startup';
import { User, testApp } from '../libs-for-tests/core-runner';

// NOTE: it-specs inside signIn process expect to run in a given order -- they
//		change app's state, expected by following specs in this describe.
describe('signIn process (empty cache)', () => {

	const s = setupWithUsers();
	let user: User;
	let w3n: web3n.startup.W3N;
	let coreInit: Promise<string>;
	let closeIPC: () => void;

	beforeAllWithTimeoutLog(async () => {
		if (!s.isUp) { return; }
		user = s.users[0];
		const runner = s.runners.get(user.userId)!;
		await runner.restart(true, false);
		({ closeIPC, coreInit, w3n } = runner.startCore());
	}, 30000);

	afterAllCond(async () => {
		closeIPC();
	});

	itCond('has no users on disk', async () => {
		const users = await w3n.signIn.getUsersOnDisk();
		expect(Array.isArray(users)).toBe(true);
		expect(users.length).toBe(0);
	});

	itCond(`won't startup with a wrong pass`, async () => {

		// start MailerId provisioning
		const userExists = await w3n.signIn.startLoginToRemoteStorage(
			user.userId);
		expect(userExists).toBe(true);

		// completing MailerId provisioning
		const notifications: number[] = [];
		const notifier = (p: number) => { notifications.push(p); }
		const ok = await w3n.signIn.completeLoginAndLocalSetup(
			'wrong password', notifier);
		expect(ok).withContext('false should be returned for wrong pass').toBe(false);
		checkKeyDerivNotifications(notifications);
	}, 60000);

	itCond('starts with correct pass', async () => {
		const core = s.runners.get(user.userId)!.core;
		try {
			core.makeCAPsForApp(testApp.appDomain, testApp.capsRequested);
			fail(`Attempt to make app CAPs before core initialization should throw up`);
		} catch (err) {}

		// start login
		const userExists = await w3n.signIn.startLoginToRemoteStorage(
			user.userId);
		expect(userExists).toBe(true);

		// complete login and a local storage setup
		const notifications: number[] = [];
		const notifier = (p: number) => { notifications.push(p); }
		const ok = await w3n.signIn.completeLoginAndLocalSetup(
			user.pass, notifier);
		expect(ok).withContext('indicates completion of login and storage setup').toBe(true);
		checkKeyDerivNotifications(notifications);

		const initAs = await coreInit;
		expect(initAs).toBe(user.userId);

		try {
			const { caps, close } = core.makeCAPsForApp(
				testApp.appDomain, testApp.capsRequested);
			expect(typeof caps).toBe('object');
			expect(typeof close).toBe('function');
			close();
		} catch (err) {
			fail(err)
		}
	}, 60000);

});