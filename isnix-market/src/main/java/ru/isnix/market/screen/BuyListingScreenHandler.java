package ru.isnix.market.screen;

import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.inventory.SimpleInventory;
import net.minecraft.item.ItemStack;
import net.minecraft.screen.GenericContainerScreenHandler;
import net.minecraft.screen.ScreenHandlerType;
import net.minecraft.screen.slot.Slot;
import net.minecraft.screen.slot.SlotActionType;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import ru.isnix.market.IsnixMarketMod;
import ru.isnix.market.listing.MarketListing;
import ru.isnix.market.trade.MarketPricing;
import ru.isnix.market.trade.MarketRatioGuard;
import ru.isnix.market.trade.PurchaseService;

/** Выбор количества при покупке (пропорциональная цена). */
public class BuyListingScreenHandler extends GenericContainerScreenHandler {
	public static final int MENU_SIZE = 27;
	public static final int SLOT_SALE = 11;
	public static final int SLOT_QTY = 13;
	public static final int SLOT_PRICE = 15;
	public static final int SLOT_MINUS = 14;
	public static final int SLOT_PLUS = 16;
	public static final int SLOT_MAX = 17;
	public static final int SLOT_CONFIRM = 22;
	public static final int SLOT_BACK = 8;

	private final SimpleInventory container;
	private final MarketSession.BuyContext ctx;

	public BuyListingScreenHandler(int syncId, PlayerInventory playerInventory) {
		super(ScreenHandlerType.GENERIC_9X3, syncId, playerInventory, buildInventory(), 3);
		this.container = (SimpleInventory) getInventory();
		if (playerInventory.player instanceof ServerPlayerEntity serverPlayer) {
			this.ctx = MarketSession.buy(serverPlayer);
			initDisplay(serverPlayer);
		} else {
			this.ctx = new MarketSession.BuyContext();
		}
	}

	private static SimpleInventory buildInventory() {
		SimpleInventory inv = new SimpleInventory(MENU_SIZE);
		for (int i = 0; i < MENU_SIZE; i++) {
			if (i == SLOT_CONFIRM) {
				inv.setStack(i, MarketScreens.buyConfirmButton(false));
			} else if (i == SLOT_BACK) {
				inv.setStack(i, MarketScreens.backButton());
			} else if (i == SLOT_MINUS) {
				inv.setStack(i, MarketScreens.countButton(false));
			} else if (i == SLOT_PLUS) {
				inv.setStack(i, MarketScreens.countButton(true));
			} else if (i == SLOT_MAX) {
				inv.setStack(i, MarketScreens.maxBuyButton());
			} else if (i == SLOT_QTY) {
				inv.setStack(i, MarketScreens.quantityInfo(1, 1));
			} else {
				inv.setStack(i, MarketScreens.fillerPane());
			}
		}
		return inv;
	}

	@Override
	public boolean canInsertIntoSlot(ItemStack stack, Slot slot) {
		return false;
	}

	@Override
	public void onSlotClick(int slotIndex, int button, SlotActionType actionType, PlayerEntity player) {
		if (!(player instanceof ServerPlayerEntity serverPlayer)) {
			return;
		}
		if (!GuiSlotPolicy.isMenuSlotIndex(slotIndex, MENU_SIZE)) {
			return;
		}
		handleMenuClick(serverPlayer, slotIndex);
	}

	private void handleMenuClick(ServerPlayerEntity player, int slotIndex) {
		MarketListing listing = currentListing();
		if (listing == null) {
			player.sendMessage(PurchaseService.messageFor(PurchaseService.Result.NOT_FOUND), false);
			player.closeHandledScreen();
			MarketScreens.openMarket(player, ctx.marketPage, ctx.marketViewMode);
			return;
		}
		if (slotIndex == SLOT_BACK) {
			player.closeHandledScreen();
			MarketScreens.openMarket(player, ctx.marketPage, ctx.marketViewMode);
			return;
		}
		if (slotIndex == SLOT_MINUS) {
			ctx.quantity = MarketPricing.clampQuantity(listing, ctx.quantity - 1);
			refreshDisplay(player, listing);
			return;
		}
		if (slotIndex == SLOT_PLUS) {
			ctx.quantity = MarketPricing.clampQuantity(listing, ctx.quantity + 1);
			refreshDisplay(player, listing);
			return;
		}
		if (slotIndex == SLOT_MAX) {
			int max = MarketPricing.maxAffordableSaleQuantity(player, listing);
			if (max < 1) {
				player.sendMessage(PurchaseService.messageFor(PurchaseService.Result.NOT_ENOUGH_ITEMS), false);
				return;
			}
			ctx.quantity = max;
			refreshDisplay(player, listing);
			return;
		}
		if (slotIndex == SLOT_CONFIRM) {
			tryConfirm(player, listing);
		}
	}

	private MarketListing currentListing() {
		if (ctx.listingId == null) {
			return null;
		}
		return IsnixMarketMod.listings().find(ctx.listingId).orElse(null);
	}

	private boolean needsShiftConfirm(MarketListing listing) {
		MarketRatioGuard.Check check = MarketRatioGuard.check(listing);
		return check.warnHigh();
	}

	private void refreshDisplay(ServerPlayerEntity player, MarketListing listing) {
		ctx.quantity = MarketPricing.clampQuantity(listing, ctx.quantity);
		container.setStack(SLOT_SALE, MarketPricing.saleStackForQuantity(listing, ctx.quantity));
		container.setStack(SLOT_PRICE, MarketPricing.priceStackForSaleQuantity(listing, ctx.quantity));
		container.setStack(
				SLOT_QTY,
				MarketScreens.quantityInfo(ctx.quantity, listing.saleItem().getCount()));
		container.setStack(SLOT_CONFIRM, MarketScreens.buyConfirmButton(needsShiftConfirm(listing)));
	}

	private void tryConfirm(ServerPlayerEntity player, MarketListing listing) {
		MarketRatioGuard.Check ratio = MarketRatioGuard.check(listing);
		if (ratio.blocked()) {
			player.sendMessage(MarketRatioGuard.blockMessage(ratio), false);
			return;
		}
		if (needsShiftConfirm(listing) && !player.isSneaking()) {
			player.sendMessage(
					Text.literal("Подозрительная цена! Зажмите Shift и нажмите «Подтвердить» ещё раз.")
							.formatted(Formatting.RED),
					false
			);
			player.sendMessage(MarketRatioGuard.warnMessage(ratio), false);
			return;
		}
		int qty = MarketPricing.clampQuantity(listing, ctx.quantity);
		PurchaseService.Result result = PurchaseService.tryPurchaseQuantity(player, listing.id(), qty);
		if (result == PurchaseService.Result.SUCCESS) {
			MarketSession.clearBuy(player);
			player.closeHandledScreen();
			MarketScreens.openMarket(player, ctx.marketPage, ctx.marketViewMode);
		} else {
			player.sendMessage(PurchaseService.messageFor(result), false);
			if (result == PurchaseService.Result.NOT_FOUND) {
				player.closeHandledScreen();
				MarketScreens.openMarket(player, ctx.marketPage, ctx.marketViewMode);
			} else {
				var fresh = currentListing();
				if (fresh != null) {
					ctx.quantity = MarketPricing.clampQuantity(fresh, ctx.quantity);
					refreshDisplay(player, fresh);
				}
			}
		}
	}

	@Override
	public ItemStack quickMove(PlayerEntity player, int slot) {
		return ItemStack.EMPTY;
	}

	@Override
	public boolean canUse(PlayerEntity player) {
		return true;
	}

	private void initDisplay(ServerPlayerEntity player) {
		MarketListing listing = currentListing();
		if (listing == null) {
			player.sendMessage(PurchaseService.messageFor(PurchaseService.Result.NOT_FOUND), false);
			player.closeHandledScreen();
			MarketScreens.openMarket(player, ctx.marketPage, ctx.marketViewMode);
			return;
		}
		MarketRatioGuard.Check ratio = MarketRatioGuard.check(listing);
		if (ratio.suspicious()) {
			player.sendMessage(MarketRatioGuard.warnMessage(ratio), false);
		}
		ctx.quantity = MarketPricing.clampQuantity(listing, ctx.quantity);
		refreshDisplay(player, listing);
	}
}
