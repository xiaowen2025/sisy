
import { clear, getJson, setJson, remove } from './storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
    setItem: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
}));

describe('storage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should set json', async () => {
        const key = 'test-key';
        const value = { foo: 'bar' };
        await setJson(key, value);
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(key, JSON.stringify(value));
    });

    it('should get json', async () => {
        const key = 'test-key';
        const value = { foo: 'bar' };
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(value));
        const result = await getJson(key);
        expect(AsyncStorage.getItem).toHaveBeenCalledWith(key);
        expect(result).toEqual(value);
    });

    it('should remove item', async () => {
        const key = 'test-key';
        await remove(key);
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith(key);
    });

    it('should clear all data', async () => {
        await clear();
        expect(AsyncStorage.clear).toHaveBeenCalled();
    });
});
