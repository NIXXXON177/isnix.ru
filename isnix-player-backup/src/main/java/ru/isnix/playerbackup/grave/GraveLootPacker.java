package ru.isnix.playerbackup.grave;

import net.minecraft.component.DataComponentTypes;
import net.minecraft.component.type.ContainerComponent;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

import java.util.ArrayList;
import java.util.List;

public final class GraveLootPacker {
	private static final int SLOTS_PER_BOX = 27;

	private GraveLootPacker() {
	}

	public static List<ItemStack> packIntoShulkers(List<ItemStack> items, String nick) {
		List<ItemStack> result = new ArrayList<>();
		if (items.isEmpty()) {
			return result;
		}
		int total = (items.size() + SLOTS_PER_BOX - 1) / SLOTS_PER_BOX;
		int index = 1;
		for (int start = 0; start < items.size(); start += SLOTS_PER_BOX, index++) {
			int end = Math.min(start + SLOTS_PER_BOX, items.size());
			List<ItemStack> chunk = new ArrayList<>(end - start);
			for (int i = start; i < end; i++) {
				chunk.add(items.get(i).copy());
			}
			ItemStack box = new ItemStack(Items.SHULKER_BOX);
			box.set(DataComponentTypes.CONTAINER, ContainerComponent.fromStacks(chunk));
			box.set(
					DataComponentTypes.CUSTOM_NAME,
					Text.literal(shulkerName(nick, index, total)).formatted(Formatting.GOLD));
			result.add(box);
		}
		return result;
	}

	static String shulkerName(String nick, int part, int total) {
		if (total <= 1) {
			return "Вещи усопшего \"" + nick + "\"";
		}
		return switch (part) {
			case 1 -> "Вещи усопшего \"" + nick + "\"";
			case 2 -> "Вторая часть вещей \"" + nick + "\"";
			case 3 -> "Третья часть вещей \"" + nick + "\"";
			default -> "Часть " + part + " вещей \"" + nick + "\"";
		};
	}
}
