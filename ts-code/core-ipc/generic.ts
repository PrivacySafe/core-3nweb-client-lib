/*
 Copyright (C) 2021 - 2022, 2024 3NSoft Inc.
 
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

import { ExposedObj, ExposedFn, W3N_NAME, CoreSideServices, Caller, CoreSide, CallerToClient, ClientSideServices, ClientSide } from "../ipc-via-protobuf/connector";
import { assert } from "../lib-common/assert";

export type CAPsExposures<T> = { [cap in keyof Required<T>]: (
	cap: any, coreSide: CoreSideServices, callerToClient: CallerToClient
) => ExposedObj<any>|ExposedFn; }

export type TypeDifference<T extends TExc, TExc extends object> = {
	[cap in Exclude<keyof T, keyof TExc>]: T[cap];
};

export function exposeCAPs<T extends W3N, W3N extends object>(
	coreSide: CoreSide, w3n: T,
	mainCAPs: CAPsExposures<W3N>,
	extraCAPs: CAPsExposures<TypeDifference<T, W3N>>|undefined
): void {
	const expW3N = {} as ExposedObj<T>;
	addCAPsInExposure(expW3N, coreSide, w3n as W3N, mainCAPs);
	if (extraCAPs) {
		addCAPsInExposure(expW3N, coreSide, w3n as TypeDifference<T, W3N>, extraCAPs);
	}
	coreSide.exposedServices.exposeW3NService(expW3N);
}

function addCAPsInExposure<T extends object>(
	expW3N: ExposedObj<T>,
	{ exposedServices, caller: callerToClient }: CoreSide,
	w3n: T,
	capExposures: CAPsExposures<T>
): void {
	for (const capName in capExposures) {
		const expose = capExposures[capName];
		assert(typeof expose === 'function');
		assert(!expW3N[capName], `Capability ${capName} is already exposed, and we specifically have no shadowing.`);
		const cap = w3n[capName];
		if (cap) {
			expW3N[capName] = expose(cap, exposedServices, callerToClient);
		}
	}
}

export type MakeCapClient = (
	clientSide: Caller, objPath: string[], expServices: ClientSideServices
) => any;

export type ClientCAPsWraps<T> = { [cap in keyof Required<T>]: MakeCapClient; };

export function makeClientSide<T extends W3N, W3N extends object>(
	{ caller, exposedServices }: ClientSide,
	mainCAPs: ClientCAPsWraps<W3N>,
	extraCAPs: ClientCAPsWraps<TypeDifference<T, W3N>>|undefined
): T {
	assert(!!caller.listObj);
	const objPath = [ W3N_NAME ];
	const lstOfCAPs = caller.listObj!(objPath) as (keyof T)[];
	const w3n = {} as T;
	for (const cap of lstOfCAPs) {
		const capObjPath = objPath.concat(cap as string);
		if (mainCAPs[cap as keyof W3N]) {
			const makeCap = mainCAPs[cap as keyof W3N];
			assert(typeof makeCap === 'function');
			w3n[cap] = makeCap(caller, capObjPath, exposedServices);
		} else if (extraCAPs) {
			const makeCap = extraCAPs[cap as keyof TypeDifference<T, W3N>];
			assert(typeof makeCap === 'function');
			w3n[cap] = makeCap(caller, capObjPath, exposedServices);
		}
	}
	return w3n;
}

export async function promiseClientSide<T extends W3N, W3N extends object>(
	{ caller, exposedServices }: ClientSide,
	mainCAPs: ClientCAPsWraps<W3N>,
	extraCAPs: ClientCAPsWraps<TypeDifference<T, W3N>>|undefined
): Promise<T> {
	assert(!!caller.listObjAsync);
	const objPath = [ W3N_NAME ];
	const lstOfCAPs = (await caller.listObjAsync!(objPath)) as (keyof T)[];
	const w3n = {} as T;
	for (const cap of lstOfCAPs) {
		const capObjPath = objPath.concat(cap as string);
		if (mainCAPs[cap as keyof W3N]) {
			const makeCap = mainCAPs[cap as keyof W3N];
			assert(typeof makeCap === 'function');
			w3n[cap] = await makeCap(caller, capObjPath, exposedServices);
		} else if (extraCAPs) {
			const makeCap = extraCAPs[cap as keyof TypeDifference<T, W3N>];
			assert(typeof makeCap === 'function');
			w3n[cap] = await makeCap(caller, capObjPath, exposedServices);
		}
	}
	return w3n;
}


Object.freeze(exports);