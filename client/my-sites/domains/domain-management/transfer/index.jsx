/**
 * External dependencies
 */
import { connect } from 'react-redux';
import React from 'react';

/**
 * Internal Dependencies
 */
import { get } from 'lodash';
import { getSelectedSiteId } from 'state/ui/selectors';
import Header from 'my-sites/domains/domain-management/components/header';
import getPrimaryDomainBySiteId from 'state/selectors/get-primary-domain-by-site-id';
import isDomainOnlySite from 'state/selectors/is-domain-only-site';
import isPrimaryDomainBySiteId from 'state/selectors/is-primary-domain-by-site-id';
import isSiteAutomatedTransfer from 'state/selectors/is-site-automated-transfer';
import { localize } from 'i18n-calypso';
import Main from 'components/main';
import {
	domainManagementEdit,
	domainManagementTransferOut,
	domainManagementTransferToAnotherUser,
	domainManagementTransferToOtherSite,
} from 'my-sites/domains/paths';
import VerticalNav from 'components/vertical-nav';
import VerticalNavItem from 'components/vertical-nav/item';
import getCurrentRoute from 'state/selectors/get-current-route';
import { getSelectedDomain, isMappedDomain } from 'lib/domains';
import DomainMainPlaceholder from 'my-sites/domains/domain-management/components/domain/main-placeholder';

function Transfer( props ) {
	const {
		isAtomic,
		isDomainOnly,
		isMappedDomain,
		isPrimaryDomain,
		selectedSite,
		selectedDomainName,
		currentRoute,
		translate,
	} = props;
	const slug = get( selectedSite, 'slug' );

	if ( props.isRequestingSiteDomains ) {
		return (
			<DomainMainPlaceholder
				backHref={ domainManagementEdit( slug, selectedDomainName, currentRoute ) }
			/>
		);
	}

	return (
		<Main>
			<Header
				selectedDomainName={ selectedDomainName }
				backHref={ domainManagementEdit( slug, selectedDomainName, currentRoute ) }
			>
				{ ! isMappedDomain ? translate( 'Transfer Domain' ) : translate( 'Transfer Mapping' ) }
			</Header>
			<VerticalNav>
				{ ! isMappedDomain && (
					<VerticalNavItem
						path={ domainManagementTransferOut( slug, selectedDomainName, currentRoute ) }
					>
						{ translate( 'Transfer to another registrar' ) }
					</VerticalNavItem>
				) }
				{ ! isMappedDomain && ! isDomainOnly && (
					<VerticalNavItem
						path={ domainManagementTransferToAnotherUser( slug, selectedDomainName, currentRoute ) }
					>
						{ translate( 'Transfer to another user' ) }
					</VerticalNavItem>
				) }

				{ ( ( isAtomic && ! isPrimaryDomain ) || ! isAtomic ) && ( // Simple and Atomic (not primary domain )
					<VerticalNavItem
						path={ domainManagementTransferToOtherSite( slug, selectedDomainName, currentRoute ) }
					>
						{ translate( 'Transfer to another WordPress.com site' ) }
					</VerticalNavItem>
				) }
			</VerticalNav>
		</Main>
	);
}

export default connect( ( state, ownProps ) => {
	const domain = getSelectedDomain( ownProps );
	const siteId = getSelectedSiteId( state );
	return {
		currentRoute: getCurrentRoute( state ),
		isAtomic: isSiteAutomatedTransfer( state, siteId ),
		isDomainOnly: isDomainOnlySite( state, siteId ),
		isMappedDomain: Boolean( domain ) && isMappedDomain( domain ),
		isPrimaryDomain: isPrimaryDomainBySiteId( state, siteId, ownProps.selectedDomainName ),
		primaryDomain: getPrimaryDomainBySiteId( state, siteId ),
	};
} )( localize( Transfer ) );
