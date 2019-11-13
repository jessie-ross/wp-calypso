/**
 * External dependencies
 */
import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { useTheme } from 'emotion-theming';
import { CardCvcElement, CardExpiryElement, CardNumberElement } from 'react-stripe-elements';

/**
 * Internal dependencies
 */
import Field from './field';
import GridRow from './grid-row';
import Button from './button';
import {
	useStripe,
	createStripePaymentMethod,
	confirmStripePaymentIntent,
	StripeHookProvider,
} from '../lib/stripe';
import {
	useSelect,
	useDispatch,
	useCheckoutHandlers,
	useLineItems,
	useCheckoutRedirects,
	renderDisplayValueMarkdown,
} from '../public-api';
import useTranslate from '../lib/localize';
import { VisaLogo, AmexLogo, MastercardLogo } from './payment-logos';
import { CreditCardLabel } from '../lib/payment-methods/credit-card';
import BillingFields, { getDomainDetailsFromPaymentData } from '../components/billing-fields';
import { SummaryLine, SummaryDetails } from '../lib/styled-components/summary-details';

export function createStripeMethod( {
	registerStore,
	fetchStripeConfiguration,
	sendStripeTransaction,
} ) {
	const actions = {
		changeBrand( payload ) {
			return { type: 'BRAND_SET', payload };
		},
		changeCardholderName( payload ) {
			return { type: 'CARDHOLDER_NAME_SET', payload };
		},
		setStripeError( payload ) {
			return { type: 'STRIPE_TRANSACTION_ERROR', payload };
		},
		*getConfiguration( payload ) {
			let configuration;
			try {
				configuration = yield { type: 'STRIPE_CONFIGURATION_FETCH', payload };
			} catch ( error ) {
				return { type: 'STRIPE_TRANSACTION_ERROR', payload: error };
			}
			return { type: 'STRIPE_CONFIGURATION_SET', payload: configuration };
		},
		*beginStripeTransaction( payload ) {
			let stripeResponse;
			try {
				stripeResponse = yield { type: 'STRIPE_TRANSACTION_BEGIN', payload };
			} catch ( error ) {
				return { type: 'STRIPE_TRANSACTION_ERROR', payload: error };
			}
			if (
				stripeResponse &&
				stripeResponse.message &&
				stripeResponse.message.payment_intent_client_secret
			) {
				return { type: 'STRIPE_TRANSACTION_AUTH', payload: stripeResponse };
			}
			if ( stripeResponse && stripeResponse.redirect_url ) {
				return { type: 'STRIPE_TRANSACTION_REDIRECT', payload: stripeResponse };
			}
			return { type: 'STRIPE_TRANSACTION_END', payload: stripeResponse };
		},
	};

	registerStore( 'stripe', {
		reducer( state = {}, action ) {
			switch ( action.type ) {
				case 'STRIPE_TRANSACTION_END':
					return {
						...state,
						transactionStatus: 'complete',
					};
				case 'STRIPE_TRANSACTION_ERROR':
					return {
						...state,
						transactionStatus: 'error',
						transactionError: action.payload,
					};
				case 'STRIPE_TRANSACTION_AUTH':
					return {
						...state,
						transactionStatus: 'auth',
						transactionAuthData: action.payload,
					};
				case 'STRIPE_TRANSACTION_REDIRECT':
					return {
						...state,
						transactionStatus: 'redirect',
					};
				case 'STRIPE_CONFIGURATION_SET':
					return { ...state, stripeConfiguration: action.payload };
				case 'CARDHOLDER_NAME_SET':
					return { ...state, cardholderName: action.payload };
				case 'BRAND_SET':
					return { ...state, brand: action.payload };
			}
			return state;
		},
		actions,
		selectors: {
			getStripeConfiguration( state ) {
				return state.stripeConfiguration;
			},
			getBrand( state ) {
				return state.brand || '';
			},
			getCardholderName( state ) {
				return state.cardholderName || '';
			},
			getTransactionError( state ) {
				return state.transactionError;
			},
			getTransactionStatus( state ) {
				return state.transactionStatus;
			},
			getTransactionAuthData( state ) {
				return state.transactionAuthData;
			},
		},
		controls: {
			STRIPE_CONFIGURATION_FETCH( action ) {
				return fetchStripeConfiguration( action.payload );
			},
			STRIPE_TRANSACTION_BEGIN( action ) {
				return sendStripeTransaction( formatDataForStripeTransaction( action.payload ) );
			},
		},
	} );

	return {
		id: 'stripe-card',
		LabelComponent: CreditCardLabel,
		PaymentMethodComponent: StripeCreditCardFields,
		BillingContactComponent: BillingFields,
		SubmitButtonComponent: StripePayButton,
		CheckoutWrapper: StripeHookProvider,
		SummaryComponent: StripeSummary,
		getAriaLabel: localize => localize( 'Credit Card' ),
	};
}

function StripeCreditCardFields( { isActive, summary } ) {
	const localize = useTranslate();
	const theme = useTheme();
	const { onFailure } = useCheckoutHandlers();
	const { stripeLoadingError, isStripeLoading } = useStripe();
	const [ cardNumberElementData, setCardNumberElementData ] = useState();
	const [ cardExpiryElementData, setCardExpiryElementData ] = useState();
	const [ cardCvcElementData, setCardCvcElementData ] = useState();
	const cardholderName = useSelect( select => select( 'stripe' ).getCardholderName() );
	const brand = useSelect( select => select( 'stripe' ).getBrand() );
	const { changeCardholderName } = useDispatch( 'stripe' );
	const { changeBrand } = useDispatch( 'stripe' );

	useEffect( () => {
		if ( stripeLoadingError ) {
			onFailure( stripeLoadingError );
		}
	}, [ onFailure, stripeLoadingError ] );

	const handleStripeFieldChange = ( input, setCardElementData ) => {
		if ( input.elementType === 'cardNumber' ) {
			changeBrand( input.brand );
		}

		if ( input.error && input.error.message ) {
			setCardElementData( input.error.message );
			return;
		}

		setCardElementData( null );
	};

	const cardNumberStyle = {
		base: {
			fontSize: '16px',
			color: theme.colors.textColor,
			fontFamily: theme.fonts.body,
			fontWeight: theme.weights.normal,
			'::placeholder': {
				color: theme.colors.textColorLight,
			},
		},
		invalid: {
			color: theme.colors.textColor,
		},
	};

	if ( ! isActive || summary ) {
		return null;
	}
	if ( stripeLoadingError ) {
		return <span>Error!</span>;
	}
	if ( isStripeLoading ) {
		return <span>Loading...</span>;
	}

	return (
		<CreditCardFieldsWrapper>
			<Label>
				<LabelText>{ localize( 'Card number' ) }</LabelText>
				<StripeFieldWrapper hasError={ cardNumberElementData }>
					<CardNumberElement
						style={ cardNumberStyle }
						onChange={ input => {
							handleStripeFieldChange( input, setCardNumberElementData );
						} }
					/>
					<CardFieldIcon brand={ brand } />

					{ cardNumberElementData && (
						<StripeErrorMessage>{ cardNumberElementData }</StripeErrorMessage>
					) }
				</StripeFieldWrapper>
			</Label>
			<FieldRow gap="4%" columnWidths="48% 48%">
				<Label>
					<LabelText>{ localize( 'Expiry date' ) }</LabelText>
					<StripeFieldWrapper hasError={ cardExpiryElementData }>
						<CardExpiryElement
							style={ cardNumberStyle }
							onChange={ input => {
								handleStripeFieldChange( input, setCardExpiryElementData );
							} }
						/>
					</StripeFieldWrapper>
					{ cardExpiryElementData && (
						<StripeErrorMessage>{ cardExpiryElementData }</StripeErrorMessage>
					) }
				</Label>
				<GridRow gap="4%" columnWidths="67% 29%">
					<Label>
						<LabelText>{ localize( 'Security code' ) }</LabelText>
						<StripeFieldWrapper hasError={ cardCvcElementData }>
							<CardCvcElement
								style={ cardNumberStyle }
								onChange={ input => {
									handleStripeFieldChange( input, setCardCvcElementData );
								} }
							/>
						</StripeFieldWrapper>
						{ cardCvcElementData && (
							<StripeErrorMessage>{ cardCvcElementData }</StripeErrorMessage>
						) }
					</Label>
					<CVVImage />
				</GridRow>
			</FieldRow>

			<CreditCardField
				id="cardholderName"
				type="Text"
				label={ localize( 'Cardholder name' ) }
				description={ localize( 'Enter your name as it’s written on the card' ) }
				value={ cardholderName }
				onChange={ changeCardholderName }
			/>
		</CreditCardFieldsWrapper>
	);
}

const CreditCardFieldsWrapper = styled.div`
	padding: 16px;
	position: relative;

	:after {
		display: block;
		width: calc( 100% - 6px );
		height: 1px;
		content: '';
		background: ${props => props.theme.colors.borderColorLight};
		position: absolute;
		top: 0;
		left: 3px;
	}
`;

const CreditCardField = styled( Field )`
	margin-top: 16px;

	:first-child {
		margin-top: 0;
	}
`;

const FieldRow = styled( GridRow )`
	margin-top: 16px;
`;

const CVVImage = styled( CVV )`
	margin-top: 21px;
	display: block;
	width: 100%;
`;

const Label = styled.label`
	display: block;

	:hover {
		cursor: pointer;
	}
`;

const LabelText = styled.span`
	display: block;
	font-size: 14px;
	font-weight: ${props => props.theme.weights.bold};
	margin-bottom: 8px;
	color: ${props => props.theme.colors.textColor};
`;

const StripeFieldWrapper = styled.span`
	position: relative;
	display: block;

	.StripeElement {
		display: block;
		width: 100%;
		box-sizing: border-box;
		border: 1px solid
			${props => ( props.hasError ? props.theme.colors.error : props.theme.colors.borderColor )};
		padding: 12px 10px;
	}

	.StripeElement--focus {
		outline: ${props => props.theme.colors.outline} auto 5px;
	}

	.StripeElement--focus.StripeElement--invalid {
		outline: ${props => props.theme.colors.error} auto 5px;
	}
`;

const StripeErrorMessage = styled.span`
	font-size: 14px;
	margin-top: 8px;
	font-style: italic;
	color: ${props => props.theme.colors.error};
	display: block;
	font-weight: ${props => props.theme.weights.normal};
`;

const LockIconGraphic = styled( LockIcon )`
	display: block;
	position: absolute;
	right: 10px;
	top: 14px
	width: 20px;
	height: 20px;
`;

function CardFieldIcon( { brand, isSummary } ) {
	let cardFieldIcon = null;

	switch ( brand ) {
		case 'visa':
			cardFieldIcon = (
				<BrandLogo isSummary={ isSummary }>
					<VisaLogo />
				</BrandLogo>
			);
			break;
		case 'mastercard':
			cardFieldIcon = (
				<BrandLogo isSummary={ isSummary }>
					<MastercardLogo />
				</BrandLogo>
			);
			break;
		case 'amex':
			cardFieldIcon = (
				<BrandLogo isSummary={ isSummary }>
					<AmexLogo />
				</BrandLogo>
			);
			break;
		default:
			cardFieldIcon = brand === 'unknown' && isSummary ? null : <LockIconGraphic />;
	}

	return cardFieldIcon;
}

const BrandLogo = styled.span`
	display: ${props => ( props.isSummary ? 'inline-block' : 'block' )};
	position: ${props => ( props.isSummary ? 'relative' : 'absolute' )};
	top: ${props => ( props.isSummary ? '0' : '15px' )};
	right: ${props => ( props.isSummary ? '0' : '10px' )};
	transform: translateY( ${props => ( props.isSummary ? '4px' : '0' )} );
`;

function CVV( { className } ) {
	const localize = useTranslate();

	return (
		<svg
			className={ className }
			width="68"
			height="41"
			viewBox="0 0 68 41"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-labelledby="cvv-image-title"
			role="img"
		>
			<title id="cvv-image-title">
				{ localize( 'An image of the back of the card where you find the security code' ) }
			</title>
			<rect x="0.919922" y="0.508789" width="67.0794" height="39.9263" rx="3" fill="#D7DADE" />
			<rect x="0.919922" y="5.75043" width="67.0794" height="10.4828" fill="#23282D" />
			<rect x="6.84361" y="21.3398" width="35.087" height="8.63682" fill="white" />
			<path
				d="M49.8528 23.2869C50.2903 23.2869 50.6262 23.4753 50.8606 23.8523C51.0969 24.2273 51.2151 24.7546 51.2151 25.4343C51.2151 26.0925 51.1008 26.615 50.8723 27.0017C50.6438 27.3865 50.3039 27.5789 49.8528 27.5789C49.4172 27.5789 49.0813 27.3914 48.845 27.0164C48.6086 26.6414 48.4905 26.114 48.4905 25.4343C48.4905 24.7742 48.6047 24.2517 48.8332 23.8669C49.0637 23.4802 49.4036 23.2869 49.8528 23.2869ZM49.8528 27.157C50.1418 27.157 50.3557 27.0203 50.4944 26.7468C50.635 26.4714 50.7053 26.0339 50.7053 25.4343C50.7053 24.8328 50.635 24.3962 50.4944 24.1248C50.3557 23.8513 50.1418 23.7146 49.8528 23.7146C49.5676 23.7146 49.3547 23.8542 49.2141 24.1335C49.0735 24.4128 49.0032 24.8464 49.0032 25.4343C49.0032 26.03 49.0725 26.4666 49.2112 26.7439C49.3518 27.0193 49.5657 27.157 49.8528 27.157ZM49.8411 24.9949C49.9641 24.9949 50.0676 25.0378 50.1516 25.1238C50.2375 25.2078 50.2805 25.3113 50.2805 25.4343C50.2805 25.5613 50.2375 25.6707 50.1516 25.7625C50.0657 25.8523 49.9622 25.8972 49.8411 25.8972C49.7219 25.8972 49.6194 25.8523 49.5334 25.7625C49.4495 25.6707 49.4075 25.5613 49.4075 25.4343C49.4075 25.3093 49.4485 25.2048 49.5305 25.1208C49.6145 25.0369 49.718 24.9949 49.8411 24.9949ZM54.5373 27.4998H52.2639V27.1511C52.8401 26.5085 53.2141 26.0779 53.386 25.8591C53.5579 25.6404 53.6975 25.4109 53.8049 25.1707C53.9123 24.9304 53.9661 24.6912 53.9661 24.4529C53.9661 24.2224 53.8957 24.0408 53.7551 23.908C53.6164 23.7751 53.4211 23.7087 53.1692 23.7087C52.9758 23.7087 52.7161 23.7683 52.3899 23.8875L52.3225 23.4744C52.6174 23.3494 52.926 23.2869 53.2483 23.2869C53.6174 23.2869 53.9143 23.3914 54.1389 23.6003C54.3655 23.8074 54.4788 24.0847 54.4788 24.4324C54.4788 24.6804 54.4202 24.9265 54.303 25.1707C54.1877 25.4148 54.0393 25.6492 53.8577 25.8738C53.676 26.0984 53.3225 26.5007 52.7971 27.0808H54.5373V27.4998ZM57.3235 25.2791C57.5754 25.3494 57.7776 25.4783 57.9299 25.6658C58.0823 25.8513 58.1584 26.0603 58.1584 26.2927C58.1584 26.656 58.0168 26.9617 57.7336 27.2097C57.4504 27.4558 57.1164 27.5789 56.7317 27.5789C56.4036 27.5789 56.1096 27.5066 55.8498 27.3621L55.9436 26.9666C56.2151 27.0935 56.4836 27.157 56.7493 27.157C56.9993 27.157 57.2122 27.0798 57.3879 26.9255C57.5657 26.7693 57.6545 26.5691 57.6545 26.325C57.6545 26.0847 57.5598 25.8894 57.3704 25.739C57.1809 25.5886 56.9299 25.5134 56.6174 25.5134H56.4914V25.1179H56.5266C56.8274 25.1179 57.0754 25.0476 57.2707 24.907C57.4661 24.7644 57.5637 24.573 57.5637 24.3328C57.5637 24.1375 57.4934 23.9851 57.3528 23.8757C57.2122 23.7644 57.0188 23.7087 56.7727 23.7087C56.5598 23.7087 56.3215 23.7664 56.0579 23.8816L55.9934 23.4685C56.259 23.3474 56.5266 23.2869 56.7961 23.2869C57.1653 23.2869 57.469 23.3845 57.7073 23.5798C57.9475 23.7732 58.0676 24.0222 58.0676 24.3269C58.0676 24.5378 57.9944 24.7351 57.8479 24.9187C57.7034 25.1003 57.5286 25.2146 57.3235 25.2615V25.2791Z"
				fill="black"
			/>
			<rect x="44.7258" y="18.9998" width="17.4205" height="13.3329" stroke="#C9356E" />
		</svg>
	);
}

function LockIcon( { className } ) {
	return (
		<svg
			className={ className }
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			aria-hidden="true"
		>
			<g fill="none">
				<path d="M0 0h24v24H0V0z" />
				<path opacity=".87" d="M0 0h24v24H0V0z" />
			</g>
			<path
				fill="#8E9196"
				d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"
			/>
		</svg>
	);
}

function StripePayButton() {
	const localize = useTranslate();
	const [ items, total ] = useLineItems();
	const { onSuccess, onFailure } = useCheckoutHandlers();
	const { successRedirectUrl, failureRedirectUrl } = useCheckoutRedirects();
	const { stripe, stripeConfiguration } = useStripe();
	const transactionStatus = useSelect( select => select( 'stripe' ).getTransactionStatus() );
	const transactionError = useSelect( select => select( 'stripe' ).getTransactionError() );
	const transactionAuthData = useSelect( select => select( 'stripe' ).getTransactionAuthData() );
	const { beginStripeTransaction } = useDispatch( 'stripe' );
	const paymentData = useSelect( select => select( 'checkout' ).getPaymentData() );
	const { billing = {}, domains = {} } = paymentData;

	useEffect( () => {
		if ( transactionStatus === 'error' ) {
			onFailure( transactionError || localize( 'An error occurred during the transaction' ) );
		}
		if ( transactionStatus === 'complete' ) {
			onSuccess();
		}
		if ( transactionStatus === 'redirect' ) {
			// TODO: notify user that we are going to redirect
		}
		if ( transactionStatus === 'auth' ) {
			showStripeModalAuth( {
				stripeConfiguration,
				response: transactionAuthData,
			} ).catch( error => {
				onFailure( error.stripeError || error.message );
			} );
		}
	}, [
		onSuccess,
		onFailure,
		transactionStatus,
		transactionError,
		transactionAuthData,
		stripeConfiguration,
		localize,
	] );

	// TODO: we need to use a placeholder for the value so the localization string can be generic
	const buttonString = localize(
		`Pay ${ renderDisplayValueMarkdown( total.amount.displayValue ) }`
	);
	return (
		<Button
			onClick={ () =>
				submitStripePayment( {
					billing,
					domains,
					items,
					total,
					stripe,
					stripeConfiguration,
					onFailure,
					successUrl: successRedirectUrl,
					cancelUrl: failureRedirectUrl,
					beginStripeTransaction,
				} )
			}
			buttonState="primary"
			buttonType="apple-pay"
			fullWidth
		>
			{ buttonString }
		</Button>
	);
}

function StripeSummary() {
	const cardholderName = useSelect( select => select( 'stripe' ).getCardholderName() );
	const brand = useSelect( select => select( 'stripe' ).getBrand() );

	return (
		<SummaryDetails>
			<SummaryLine>{ cardholderName }</SummaryLine>
			<SummaryLine>
				{ brand !== 'unknown' && '****' } <CardFieldIcon brand={ brand } isSummary={ true } />
			</SummaryLine>
		</SummaryDetails>
	);
}

async function submitStripePayment( {
	items,
	total,
	stripe,
	stripeConfiguration,
	onFailure,
	successUrl,
	cancelUrl,
	billing,
	domains,
	beginStripeTransaction,
} ) {
	const name = billing.name || '';
	const country = billing.country || '';
	const postalCode = billing.zipCode || billing.postalCode || '';
	const phone = domains.phone || '';
	const subdivisionCode = billing.state || billing.province || '';
	// TODO: validate fields
	const paymentDetailsForStripe = {
		name,
		address: {
			country,
			postal_code: postalCode,
		},
	};

	if ( phone ) {
		paymentDetailsForStripe.phone = phone;
	}

	try {
		const stripePaymentMethod = await createStripePaymentMethod( stripe, paymentDetailsForStripe );
		const dataForTransaction = {
			items,
			total,
			country,
			postalCode,
			subdivisionCode,
			paymentData: { billing, domains },
			stripePaymentMethod,
			stripeConfiguration,
			successUrl,
			cancelUrl,
		};
		beginStripeTransaction( dataForTransaction );
	} catch ( error ) {
		onFailure( error );
		return;
	}
}

async function showStripeModalAuth( { stripeConfiguration, response } ) {
	const authenticationResponse = await confirmStripePaymentIntent(
		stripeConfiguration,
		response.message.payment_intent_client_secret
	);

	if ( authenticationResponse ) {
		// TODO: what do we do here?
	}
}

function formatDataForStripeTransaction( {
	name,
	items,
	total,
	country,
	postalCode,
	subdivisionCode,
	paymentData,
	stripePaymentMethod,
	stripeConfiguration,
	successUrl,
	cancelUrl,
} ) {
	const siteId = ''; // TODO: get site id
	const couponId = null; // TODO: get couponId
	const payment = {
		payment_method: 'WPCOM_Billing_Stripe_Payment_Method',
		payment_key: stripePaymentMethod.id,
		payment_partner: stripeConfiguration.processor_id,
		name,
		zip: postalCode,
		country,
		successUrl,
		cancelUrl,
	};
	return {
		cart: createCartFromLineItems( {
			siteId,
			couponId,
			items,
			total,
			country,
			postalCode,
			subdivisionCode,
		} ),
		domain_details: getDomainDetailsFromPaymentData( paymentData ),
		payment,
	};
}

function createCartFromLineItems( {
	siteId,
	couponId,
	items,
	country,
	postalCode,
	subdivisionCode,
} ) {
	// TODO: use cart manager to create cart object needed for this transaction
	const currency = items.reduce( ( value, item ) => value || item.amount.currency );
	return {
		blog_id: siteId,
		coupon: couponId || '',
		currency: currency || '',
		temporary: false,
		extra: [],
		products: items.map( item => ( {
			product_id: item.id,
			meta: '', // TODO: get this for domains, etc
			cost: item.amount.value, // TODO: how to convert this from 3500 to 35?
			currency: item.amount.currency,
			volume: 1,
		} ) ),
		tax: {
			location: {
				country_code: country,
				postal_code: postalCode,
				subdivision_code: subdivisionCode,
			},
		},
	};
}
