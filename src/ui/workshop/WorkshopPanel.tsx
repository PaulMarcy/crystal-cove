import { useEffect } from 'react';
import {
  canCraft,
  discountedRecipe,
  ingredientStatus,
  isRecipeTaught,
  isRecipeUnlocked,
  isRecipeVisible,
} from '../../core/economy/crafting';
import { allRecipes, type RecipeDef } from '../../data/recipes';
import { strings } from '../../shared/strings';
import { modifiersOf, useGameStore } from '../../shared/store';

const itemNames = strings.items as Readonly<Record<string, string>>;
const cardStrings = strings.cards as Readonly<
  Record<string, { name: string; description: string }>
>;

/** What the recipe produces, as text (information never color-only, docs/11). */
function outputLabel(recipe: RecipeDef): string {
  if (recipe.output.kind === 'toolUpgrade') return strings.workshop.outputTool;
  return recipe.station === 'kitchen' ? strings.workshop.outputDish : strings.workshop.outputCard;
}

function outputDescription(recipe: RecipeDef): string {
  if (recipe.output.kind === 'toolUpgrade') return strings.recipes.tool_reinforced.description;
  return cardStrings[recipe.output.cardId]?.description ?? '';
}

function RecipeRow({
  recipe: baseRecipe,
  stationTier,
}: {
  recipe: RecipeDef;
  stationTier: number;
}) {
  const inventory = useGameStore((s) => s.inventory);
  const craftRecipe = useGameStore((s) => s.craftRecipe);
  // Talent "Sparsame Hände" — display the same discounted costs the store
  // deducts (rule in core/economy/crafting).
  const craftDiscount = useGameStore((s) => modifiersOf(s).craftBaseMaterialDiscount);
  const recipe = discountedRecipe(baseRecipe, craftDiscount);
  const unlocked = isRecipeUnlocked(recipe, stationTier);
  const craftable = unlocked && canCraft(inventory, recipe);

  return (
    <li className={`workshop-recipe${unlocked ? '' : ' workshop-recipe--locked'}`}>
      <div className="workshop-recipe-head">
        <span className="workshop-recipe-name">{recipe.name}</span>
        <span className="workshop-recipe-kind">{outputLabel(recipe)}</span>
      </div>
      <p className="workshop-recipe-desc">{outputDescription(recipe)}</p>
      <ul className="workshop-ingredients">
        {ingredientStatus(inventory, recipe).map(({ resource, have, need }) => (
          <li
            key={resource}
            className={`workshop-ingredient${have < need ? ' workshop-ingredient--missing' : ''}`}
          >
            {itemNames[resource] ?? resource} {Math.min(have, need)}/{need}
            {/* Text marker so missing material is never color-only (docs/11). */}
            {have < need && (
              <span className="workshop-missing-tag"> ({strings.workshop.missingMaterial})</span>
            )}
          </li>
        ))}
      </ul>
      {unlocked ? (
        <button
          className="workshop-craft-button"
          disabled={!craftable}
          onClick={() => craftRecipe(recipe.id)}
        >
          {strings.workshop.craft}
        </button>
      ) : (
        <span className="workshop-locked-hint">
          {strings.workshop.lockedHint.replace('{tier}', String(recipe.stationTier))}
        </span>
      )}
    </li>
  );
}

/**
 * Workshop overlay (M3): recipe list of the open station with owned/needed
 * ingredient counts. Tier-2 recipes are visible but locked (docs/10);
 * owned tool upgrades disappear. Pure render layer — craft logic lives in
 * core/economy/crafting, dispatched through the store.
 */
export function WorkshopPanel() {
  const activeStation = useGameStore((s) => s.activeStation);
  const closeStation = useGameStore((s) => s.closeStation);
  const toolTier = useGameStore((s) => s.toolTier);
  const collection = useGameStore((s) => s.collection);
  const stationTiers = useGameStore((s) => s.stationTiers);
  const unlockedRecipes = useGameStore((s) => s.unlockedRecipes);

  useEffect(() => {
    if (!activeStation) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeStation();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeStation, closeStation]);

  // The Deck-Truhe has its own overlay (DeckChestPanel) — this panel only
  // renders crafting stations with recipes.
  if (!activeStation || activeStation === 'deck_chest') return null;
  // Station tier is store state (M5: B2/B3 builds raise it, docs/09).
  const stationTier = stationTiers[activeStation] ?? 1;
  // Quest-gated recipes stay hidden until their NPC lesson (docs/09, M5);
  // tier-locked ones remain visible-but-locked (docs/10).
  const recipes = allRecipes.filter(
    (r) =>
      r.station === activeStation &&
      isRecipeVisible(r, toolTier) &&
      isRecipeTaught(r, unlockedRecipes),
  );

  return (
    <section className="workshop-panel" aria-label={strings.stations[activeStation]}>
      <header className="workshop-header">
        <h2 className="workshop-title">{strings.stations[activeStation]}</h2>
        <button className="workshop-close" onClick={closeStation}>
          {strings.workshop.close}
        </button>
      </header>
      <p className="workshop-collection">
        {strings.workshop.collectionCount.replace('{count}', String(collection.length))}
      </p>
      <ul className="workshop-recipes">
        {recipes.map((recipe) => (
          <RecipeRow key={recipe.id} recipe={recipe} stationTier={stationTier} />
        ))}
      </ul>
    </section>
  );
}
