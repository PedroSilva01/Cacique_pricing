import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
	return twMerge(clsx(inputs));
}

export function getErrorMessage(error, defaultMessage = 'Ocorreu um erro inesperado. Tente novamente.') {
	if (!error) return defaultMessage;
	if (typeof error === 'string') return error;
	if (typeof error.message === 'string' && error.message.trim()) {
		return error.message;
	}
	if (typeof error.code === 'string') {
		return `Código do erro: ${error.code}`;
	}
	return defaultMessage;
}

export function showErrorToast(toast, { title = 'Erro', error, defaultDescription, descriptionPrefix } = {}) {
	if (!toast) return;

	const baseMessage = getErrorMessage(error, defaultDescription);
	const description = descriptionPrefix ? `${descriptionPrefix}: ${baseMessage}` : baseMessage;

	toast({
		title,
		description,
		variant: 'destructive',
	});
}